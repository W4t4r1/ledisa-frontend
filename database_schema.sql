-- ==========================================
-- SCRIPT DE BASE DE DATOS: Módulo ERP LEDISA
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- Habilitar extensión UUID si no está activa
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: Clientes (CRM)
CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_documento VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'CE', 'OTROS')),
    documento VARCHAR(20) UNIQUE NOT NULL,
    nombre_razon_social VARCHAR(150) NOT NULL,
    celular VARCHAR(20),
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Crear índice para búsquedas rápidas por DNI/RUC
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);

-- 2. TABLA: Ventas y Cotizaciones
CREATE TABLE IF NOT EXISTS ventas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_venta VARCHAR(30) UNIQUE NOT NULL, -- Ej: V-260714-0021, C-260714-0104
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    descuento NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('Efectivo', 'Yape/Plin', 'Transferencia BCP', 'Transferencia Interbancaria', 'Tarjeta Credito/Debito', 'Credito', 'Sin Especificar')),
    estado VARCHAR(25) NOT NULL CHECK (estado IN ('COTIZACION', 'PAGADO', 'ENTREGADO', 'ANULADO')),
    vendedor_id VARCHAR(50) DEFAULT 'admin',
    nota TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ventas_codigo ON ventas(codigo_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);

-- 3. TABLA: Detalle de Ventas
CREATE TABLE IF NOT EXISTS ventas_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    producto_id VARCHAR(100) NOT NULL REFERENCES inventario(id),
    cantidad_cajas INT NOT NULL DEFAULT 0,
    piezas_sueltas INT NOT NULL DEFAULT 0,
    precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_detalle_venta ON ventas_detalle(venta_id);

-- 4. TABLA: Historial de Inventario (Kardex)
CREATE TABLE IF NOT EXISTS kardex (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id VARCHAR(100) NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA')),
    cantidad_cajas INT NOT NULL DEFAULT 0,
    piezas_sueltas INT NOT NULL DEFAULT 0,
    motivo VARCHAR(50) NOT NULL CHECK (motivo IN ('VENTA', 'COMPRA', 'AJUSTE', 'ROTURA', 'DEVOLUCION', 'ANULACION_VENTA')),
    referencia_id UUID, -- ID de venta, compra o ajuste respectivo
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kardex_producto ON kardex(producto_id);
CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex(fecha);


-- ==========================================
-- FUNCIÓN RPC: registrar_venta
-- Registra una venta, su detalle, descuenta el stock de inventario
-- e inserta las bitácoras en el Kardex en una única transacción atómica.
-- ==========================================

CREATE OR REPLACE FUNCTION registrar_venta(
    p_cliente_id UUID,
    p_subtotal NUMERIC,
    p_descuento NUMERIC,
    p_total NUMERIC,
    p_metodo_pago VARCHAR,
    p_estado VARCHAR,
    p_nota TEXT,
    p_items JSONB -- Formato: [{"producto_id": "P01", "cantidad_cajas": 5, "piezas_sueltas": 0, "precio_unitario": 45.0, "subtotal": 225.0}]
) RETURNS VARCHAR AS $$
DECLARE
    v_venta_id UUID;
    v_codigo_venta VARCHAR(30);
    v_prefix VARCHAR(2);
    v_item JSONB;
    v_producto_id VARCHAR(100);
    v_cant_cajas INT;
    v_pzs_sueltas INT;
    v_precio_unit NUMERIC;
    v_subtotal_item NUMERIC;
    v_stock_actual INT;
    v_pzs_actual INT;
    v_nombre_prod TEXT;
    v_m2_caja NUMERIC;
BEGIN
    -- Determinar prefijo
    IF p_estado = 'COTIZACION' THEN
        v_prefix := 'C-';
    ELSE
        v_prefix := 'V-';
    END IF;

    -- Generar código correlativo temporal
    v_codigo_venta := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Insertar en cabecera de venta
    INSERT INTO ventas (codigo_venta, cliente_id, subtotal, descuento, total, metodo_pago, estado, nota)
    VALUES (v_codigo_venta, p_cliente_id, p_subtotal, p_descuento, p_total, p_metodo_pago, p_estado, p_nota)
    RETURNING id INTO v_venta_id;

    -- Iterar sobre el array de items en formato JSONB
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_precio_unit := (v_item->>'precio_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        -- Obtener stock actual para validación y alertas
        SELECT stock, piezas_sueltas, nombre, m2_caja 
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja
        FROM inventario 
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        -- Si la venta no es solo una cotización (es decir, está PAGADO o ENTREGADO), restamos stock
        IF p_estado IN ('PAGADO', 'ENTREGADO') THEN
            -- Validar si hay suficiente mercadería y descontarla
            IF v_m2_caja > 0 THEN
                IF v_stock_actual < v_cant_cajas OR v_pzs_actual < v_pzs_sueltas THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % cjs, % pzs. Requerido % cjs, % pzs.', 
                        v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_actual, v_cant_cajas, v_pzs_sueltas;
                END IF;

                -- Descontar el stock
                UPDATE inventario 
                SET stock = stock - v_cant_cajas,
                    piezas_sueltas = piezas_sueltas - v_pzs_sueltas
                WHERE id = v_producto_id;

                -- Registrar movimiento de salida en el Kardex
                INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                VALUES (v_producto_id, 'SALIDA', v_cant_cajas, v_pzs_sueltas, 'VENTA', v_venta_id);
            ELSE
                -- Para productos por unidad, v_pzs_sueltas es la cantidad de unidades vendidas, y se resta de stock (que almacena las unidades totales)
                IF v_stock_actual < v_pzs_sueltas THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % unidades. Requerido % unidades.', 
                        v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_sueltas;
                END IF;

                -- Descontar el stock
                UPDATE inventario 
                SET stock = stock - v_pzs_sueltas,
                    piezas_sueltas = 0 -- Asegurar que piezas sueltas quede en 0
                WHERE id = v_producto_id;

                -- Registrar movimiento de salida en el Kardex
                INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                VALUES (v_producto_id, 'SALIDA', 0, v_pzs_sueltas, 'VENTA', v_venta_id);
            END IF;
        END IF;

        -- Insertar en el detalle de la venta
        INSERT INTO ventas_detalle (venta_id, producto_id, cantidad_cajas, piezas_sueltas, precio_unitario, subtotal)
        VALUES (v_venta_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_precio_unit, v_subtotal_item);

    END LOOP;

    RETURN v_codigo_venta;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- MIGRACIÓN: AGREGAR APARTADO DE COSTO Y GANANCIA NETA
-- ==========================================

-- 1. Agregar columna costo a la tabla inventario
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS costo NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 2. Agregar columna total_costo a la tabla ventas
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS total_costo NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 3. Agregar columna costo_unitario a la tabla ventas_detalle
ALTER TABLE ventas_detalle ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00;

-- 4. Actualizar la función RPC registrar_venta para almacenar el costo
CREATE OR REPLACE FUNCTION registrar_venta(
    p_cliente_id UUID,
    p_subtotal NUMERIC,
    p_descuento NUMERIC,
    p_total NUMERIC,
    p_metodo_pago VARCHAR,
    p_estado VARCHAR,
    p_nota TEXT,
    p_items JSONB -- Formato: [{"producto_id": "P01", "cantidad_cajas": 5, "piezas_sueltas": 0, "precio_unitario": 45.0, "costo_unitario": 30.0, "piezas_por_caja": 6, "subtotal": 225.0}]
) RETURNS VARCHAR AS $$
DECLARE
    v_venta_id UUID;
    v_codigo_venta VARCHAR(30);
    v_prefix VARCHAR(2);
    v_item JSONB;
    v_producto_id VARCHAR(100);
    v_cant_cajas INT;
    v_pzs_sueltas INT;
    v_precio_unit NUMERIC;
    v_costo_unit NUMERIC;
    v_pzs_por_caja INT;
    v_subtotal_item NUMERIC;
    v_costo_item NUMERIC;
    v_total_costo NUMERIC := 0.00;
    v_stock_actual INT;
    v_pzs_actual INT;
    v_nombre_prod TEXT;
    v_m2_caja NUMERIC;
    v_costo_prod NUMERIC;
BEGIN
    -- Determinar prefijo
    IF p_estado = 'COTIZACION' THEN
        v_prefix := 'C-';
    ELSE
        v_prefix := 'V-';
    END IF;

    -- Generar código correlativo temporal
    v_codigo_venta := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Iterar primero para calcular el total_costo acumulado de la venta
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_pzs_por_caja := COALESCE((v_item->>'piezas_por_caja')::INT, 6);

        -- Obtener datos para calcular el costo de forma dinámica
        SELECT stock, piezas_sueltas, nombre, m2_caja, costo
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod
        FROM inventario
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        -- Usamos el costo enviado por el frontend (histórico) o el costo actual de inventario como fallback
        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        IF v_m2_caja > 0 THEN
            v_costo_item := ((v_cant_cajas * v_m2_caja) + (v_pzs_sueltas * (v_m2_caja / v_pzs_por_caja))) * v_costo_unit;
        ELSE
            v_costo_item := v_pzs_sueltas * v_costo_unit;
        END IF;

        v_total_costo := v_total_costo + v_costo_item;
    END LOOP;

    -- Insertar en cabecera de venta
    INSERT INTO ventas (codigo_venta, cliente_id, subtotal, descuento, total, total_costo, metodo_pago, estado, nota)
    VALUES (v_codigo_venta, p_cliente_id, p_subtotal, p_descuento, p_total, v_total_costo, p_metodo_pago, p_estado, p_nota)
    RETURNING id INTO v_venta_id;

    -- Iterar de nuevo para detalle, kardex y descontar stock
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_precio_unit := (v_item->>'precio_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod
        FROM inventario
        WHERE id = v_producto_id;

        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        -- Descontar stock e insertar Kardex
        IF p_estado IN ('PAGADO', 'ENTREGADO') THEN
            IF v_m2_caja > 0 THEN
                IF v_stock_actual < v_cant_cajas OR v_pzs_actual < v_pzs_sueltas THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % cjs, % pzs. Requerido % cjs, % pzs.', 
                        v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_actual, v_cant_cajas, v_pzs_sueltas;
                END IF;

                UPDATE inventario 
                SET stock = stock - v_cant_cajas,
                    piezas_sueltas = piezas_sueltas - v_pzs_sueltas
                WHERE id = v_producto_id;

                INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                VALUES (v_producto_id, 'SALIDA', v_cant_cajas, v_pzs_sueltas, 'VENTA', v_venta_id);
            ELSE
                IF v_stock_actual < v_pzs_sueltas THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % unidades. Requerido % unidades.', 
                        v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_sueltas;
                END IF;

                UPDATE inventario 
                SET stock = stock - v_pzs_sueltas,
                    piezas_sueltas = 0
                WHERE id = v_producto_id;

                INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                VALUES (v_producto_id, 'SALIDA', 0, v_pzs_sueltas, 'VENTA', v_venta_id);
            END IF;
        END IF;

        -- Insertar en el detalle de la venta (incluyendo costo_unitario)
        INSERT INTO ventas_detalle (venta_id, producto_id, cantidad_cajas, piezas_sueltas, precio_unitario, costo_unitario, subtotal)
        VALUES (v_venta_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_precio_unit, v_costo_unit, v_subtotal_item);

    END LOOP;

    RETURN v_codigo_venta;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- SECCIÓN: COMPRAS Y PROVEEDORES
-- ==========================================

-- 1. TABLA: Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_documento VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('DNI', 'RUC', 'CE', 'OTROS')),
    documento VARCHAR(20) UNIQUE NOT NULL,
    razon_social VARCHAR(150) NOT NULL,
    celular VARCHAR(20),
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proveedores_doc ON proveedores(documento);

-- 2. TABLA: Compras
CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_compra VARCHAR(30) UNIQUE NOT NULL, -- Ej: COM-260715-0132
    proveedor_id UUID REFERENCES proveedores(id) ON DELETE SET NULL,
    numero_factura VARCHAR(50) NOT NULL,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    metodo_pago VARCHAR(50) CHECK (metodo_pago IN ('Efectivo', 'Yape/Plin', 'Transferencia BCP', 'Transferencia Interbancaria', 'Tarjeta Credito/Debito', 'Credito', 'Sin Especificar')),
    nota TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compras_codigo ON compras(codigo_compra);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);

-- 3. TABLA: Detalle de Compras
CREATE TABLE IF NOT EXISTS compras_detalle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
    producto_id VARCHAR(100) NOT NULL REFERENCES inventario(id),
    cantidad_cajas INT NOT NULL DEFAULT 0,
    piezas_sueltas INT NOT NULL DEFAULT 0,
    costo_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_compras_detalle_compra ON compras_detalle(compra_id);

-- 4. FUNCIÓN RPC: registrar_compra (Transaccional)
CREATE OR REPLACE FUNCTION registrar_compra(
    p_proveedor_id UUID,
    p_numero_factura VARCHAR,
    p_total NUMERIC,
    p_metodo_pago VARCHAR,
    p_nota TEXT,
    p_items JSONB -- Formato: [{"producto_id": "P01", "cantidad_cajas": 10, "piezas_sueltas": 0, "costo_unitario": 28.5, "subtotal": 285.0}]
) RETURNS VARCHAR AS $$
DECLARE
    v_compra_id UUID;
    v_codigo_compra VARCHAR(30);
    v_item JSONB;
    v_producto_id VARCHAR(100);
    v_cant_cajas INT;
    v_pzs_sueltas INT;
    v_costo_unit NUMERIC;
    v_subtotal_item NUMERIC;
    v_stock_actual INT;
    v_pzs_actual INT;
    v_m2_caja NUMERIC;
BEGIN
    -- Generar código correlativo de compra
    v_codigo_compra := 'COM-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Insertar en cabecera de compras
    INSERT INTO compras (codigo_compra, proveedor_id, numero_factura, total, metodo_pago, nota)
    VALUES (v_codigo_compra, p_proveedor_id, p_numero_factura, p_total, p_metodo_pago, p_nota)
    RETURNING id INTO v_compra_id;

    -- Iterar sobre los productos comprados
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_costo_unit := (v_item->>'costo_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        -- Validar producto en inventario
        SELECT stock, piezas_sueltas, m2_caja INTO v_stock_actual, v_pzs_actual, v_m2_caja
        FROM inventario 
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        -- 1. Incrementar el stock y actualizar costo del catálogo
        IF v_m2_caja > 0 THEN
            UPDATE inventario 
            SET stock = stock + v_cant_cajas,
                piezas_sueltas = piezas_sueltas + v_pzs_sueltas,
                costo = v_costo_unit
            WHERE id = v_producto_id;

            -- 2. Registrar movimiento de entrada en el Kardex
            INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
            VALUES (v_producto_id, 'ENTRADA', v_cant_cajas, v_pzs_sueltas, 'COMPRA', v_compra_id);
        ELSE
            -- Si es por unidades sueltas, sumamos directamente a stock (que almacena las unidades físicas)
            UPDATE inventario 
            SET stock = stock + v_pzs_sueltas,
                costo = v_costo_unit
            WHERE id = v_producto_id;

            -- Registrar movimiento de entrada en el Kardex
            INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
            VALUES (v_producto_id, 'ENTRADA', 0, v_pzs_sueltas, 'COMPRA', v_compra_id);
        END IF;

        -- 3. Insertar detalle de compra
        INSERT INTO compras_detalle (compra_id, producto_id, cantidad_cajas, piezas_sueltas, costo_unitario, subtotal)
        VALUES (v_compra_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_costo_unit, v_subtotal_item);

    END LOOP;

    RETURN v_codigo_compra;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- SECCIÓN: CIERRE DE CAJA Y CAJA CHICA
-- ==========================================

-- 1. TABLA: Sesiones de Caja
CREATE TABLE IF NOT EXISTS cajas_sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha_apertura TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    fecha_cierre TIMESTAMP WITH TIME ZONE,
    monto_apertura NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    monto_cierre_efectivo_calculado NUMERIC(12, 2),
    monto_cierre_efectivo_real NUMERIC(12, 2),
    diferencia NUMERIC(12, 2),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'CERRADA')),
    total_ventas_efectivo NUMERIC(12, 2) DEFAULT 0.00,
    total_ventas_tarjeta NUMERIC(12, 2) DEFAULT 0.00,
    total_ventas_transferencia NUMERIC(12, 2) DEFAULT 0.00,
    total_ventas_yape NUMERIC(12, 2) DEFAULT 0.00,
    total_egresos_caja_chica NUMERIC(12, 2) DEFAULT 0.00,
    total_ingresos_caja_chica NUMERIC(12, 2) DEFAULT 0.00,
    monto_cierre_tarjeta_real NUMERIC(12, 2) DEFAULT 0.00,
    diferencia_tarjeta NUMERIC(12, 2) DEFAULT 0.00,
    monto_cierre_transferencia_real NUMERIC(12, 2) DEFAULT 0.00,
    diferencia_transferencia NUMERIC(12, 2) DEFAULT 0.00,
    monto_cierre_yape_real NUMERIC(12, 2) DEFAULT 0.00,
    diferencia_yape NUMERIC(12, 2) DEFAULT 0.00,
    nota TEXT
);

CREATE INDEX IF NOT EXISTS idx_cajas_estado ON cajas_sesiones(estado);

-- 2. TABLA: Movimientos de Caja Chica
CREATE TABLE IF NOT EXISTS caja_chica_movimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES cajas_sesiones(id) ON DELETE CASCADE,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    motivo VARCHAR(200) NOT NULL,
    metodo_pago VARCHAR(50) DEFAULT 'Efectivo',
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cajachica_sesion ON caja_chica_movimientos(sesion_id);

-- 3. ALTERACIÓN: Asociar Ventas a Sesión de Caja
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS sesion_caja_id UUID REFERENCES cajas_sesiones(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_sesion_caja ON ventas(sesion_caja_id);

-- 4. ACTUALIZACIÓN DEL RPC: registrar_venta (Asignación automática de caja activa)
CREATE OR REPLACE FUNCTION registrar_venta(
    p_cliente_id UUID,
    p_subtotal NUMERIC,
    p_descuento NUMERIC,
    p_total NUMERIC,
    p_metodo_pago VARCHAR,
    p_estado VARCHAR,
    p_nota TEXT,
    p_items JSONB
) RETURNS VARCHAR AS $$
DECLARE
    v_venta_id UUID;
    v_codigo_venta VARCHAR(30);
    v_prefix VARCHAR(2);
    v_item JSONB;
    v_producto_id VARCHAR(100);
    v_cant_cajas INT;
    v_pzs_sueltas INT;
    v_precio_unit NUMERIC;
    v_costo_unit NUMERIC;
    v_pzs_por_caja INT;
    v_subtotal_item NUMERIC;
    v_costo_item NUMERIC;
    v_total_costo NUMERIC := 0.00;
    v_stock_actual INT;
    v_pzs_actual INT;
    v_nombre_prod TEXT;
    v_m2_caja NUMERIC;
    v_costo_prod NUMERIC;
    v_sesion_caja_id UUID;
BEGIN
    -- Buscar sesión de caja abierta activa
    SELECT id INTO v_sesion_caja_id 
    FROM cajas_sesiones 
    WHERE estado = 'ABIERTA' 
    ORDER BY fecha_apertura DESC 
    LIMIT 1;

    IF p_estado = 'COTIZACION' THEN
        v_prefix := 'C-';
    ELSE
        v_prefix := 'V-';
    END IF;

    v_codigo_venta := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_pzs_por_caja := COALESCE((v_item->>'piezas_por_caja')::INT, 6);

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod
        FROM inventario
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        IF v_m2_caja > 0 THEN
            v_costo_item := ((v_cant_cajas * v_m2_caja) + (v_pzs_sueltas * (v_m2_caja / v_pzs_por_caja))) * v_costo_unit;
        ELSE
            v_costo_item := v_pzs_sueltas * v_costo_unit;
        END IF;

        v_total_costo := v_total_costo + v_costo_item;
    END LOOP;

    -- Registrar la venta vinculando la sesion_caja_id
    INSERT INTO ventas (codigo_venta, cliente_id, subtotal, descuento, total, total_costo, metodo_pago, estado, nota, sesion_caja_id)
    VALUES (v_codigo_venta, p_cliente_id, p_subtotal, p_descuento, p_total, v_total_costo, p_metodo_pago, p_estado, p_nota, v_sesion_caja_id)
    RETURNING id INTO v_venta_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_precio_unit := (v_item->>'precio_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod
        FROM inventario
        WHERE id = v_producto_id;

        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        IF p_estado IN ('PAGADO', 'ENTREGADO') THEN
            IF v_m2_caja > 0 THEN
                DECLARE
                    v_pzs_faltantes INT := 0;
                    v_cajas_a_abrir INT := 0;
                    v_pzs_totales_disp INT;
                    v_pzs_totales_req INT;
                BEGIN
                    v_pzs_totales_disp := (v_stock_actual * v_pzs_por_caja) + v_pzs_actual;
                    v_pzs_totales_req := (v_cant_cajas * v_pzs_por_caja) + v_pzs_sueltas;

                    IF v_pzs_totales_disp < v_pzs_totales_req THEN
                        RAISE EXCEPTION 'Stock insuficiente para % (%): stock total disp. % pzs (% cjs + % pzs). Requerido % pzs (% cjs + % pzs).', 
                            v_nombre_prod, v_producto_id, v_pzs_totales_disp, v_stock_actual, v_pzs_actual, v_pzs_totales_req, v_cant_cajas, v_pzs_sueltas;
                    END IF;

                    -- Si las piezas sueltas disponibles no alcanzan, abrimos las cajas necesarias automáticamente
                    IF v_pzs_actual < v_pzs_sueltas THEN
                        v_pzs_faltantes := v_pzs_sueltas - v_pzs_actual;
                        v_cajas_a_abrir := CEIL(v_pzs_faltantes::NUMERIC / v_pzs_por_caja::NUMERIC)::INT;
                    END IF;

                    UPDATE inventario 
                    SET stock = stock - v_cant_cajas - v_cajas_a_abrir,
                        piezas_sueltas = piezas_sueltas + (v_cajas_a_abrir * v_pzs_por_caja) - v_pzs_sueltas
                    WHERE id = v_producto_id;

                    INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                    VALUES (v_producto_id, 'SALIDA', v_cant_cajas + v_cajas_a_abrir, v_pzs_sueltas, 'VENTA', v_venta_id);
                END;
            ELSE
                IF v_stock_actual < v_pzs_sueltas THEN
                    RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % unidades. Requerido % unidades.', 
                        v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_sueltas;
                END IF;

                UPDATE inventario 
                SET stock = stock - v_pzs_sueltas,
                    piezas_sueltas = 0
                WHERE id = v_producto_id;

                INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                VALUES (v_producto_id, 'SALIDA', 0, v_pzs_sueltas, 'VENTA', v_venta_id);
            END IF;
        END IF;

        INSERT INTO ventas_detalle (venta_id, producto_id, cantidad_cajas, piezas_sueltas, precio_unitario, costo_unitario, subtotal)
        VALUES (v_venta_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_precio_unit, v_costo_unit, v_subtotal_item);

    END LOOP;

    RETURN v_codigo_venta;
END;
$$ LANGUAGE plpgsql;

-- 5. MIGRACIÓN: Agregar columna ubicacion_fisica en inventario
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS ubicacion_fisica VARCHAR(100);

