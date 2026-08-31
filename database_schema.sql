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
    p_items JSONB, -- Formato: [{"producto_id": "P01", "cantidad_cajas": 10, "piezas_sueltas": 0, "costo_unitario": 28.5, "subtotal": 285.0}]
    p_estado_factura VARCHAR DEFAULT 'FACTURADO'
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
    v_estado_fac VARCHAR(20);
BEGIN
    v_estado_fac := COALESCE(p_estado_factura, 'FACTURADO');
    -- Generar código correlativo de compra
    v_codigo_compra := 'COM-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    -- Insertar en cabecera de compras
    INSERT INTO compras (codigo_compra, proveedor_id, numero_factura, total, metodo_pago, nota, estado_factura)
    VALUES (v_codigo_compra, p_proveedor_id, p_numero_factura, p_total, p_metodo_pago, p_nota, v_estado_fac)
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

-- 6. MIGRACIÓN: Agregar columna estado_factura en compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS estado_factura VARCHAR(20) DEFAULT 'FACTURADO';

-- ==========================================
-- SECCIÓN: PRODUCTOS COMBO / KITS (1/2 BAÑO, INODOROS, ETC.)
-- ==========================================

-- 1. Agregar columna es_combo a la tabla inventario
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS es_combo BOOLEAN DEFAULT FALSE;

-- 2. TABLA: Componentes de Productos Combo
CREATE TABLE IF NOT EXISTS producto_componentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id VARCHAR(100) NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
    componente_id VARCHAR(100) NOT NULL REFERENCES inventario(id) ON DELETE CASCADE,
    cantidad INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (combo_id, componente_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_comp_combo ON producto_componentes(combo_id);
CREATE INDEX IF NOT EXISTS idx_prod_comp_componente ON producto_componentes(componente_id);

-- 3. ACTUALIZACIÓN DEL RPC: registrar_venta CON SOPORTE PARA PRODUCTOS COMBO
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
    v_es_combo BOOLEAN;
    v_sesion_caja_id UUID;
    
    -- Variables para iterar componentes de combo
    v_comp RECORD;
    v_cant_comp_req INT;
    v_tiene_componentes BOOLEAN;
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

    -- Iteración 1: Calcular total_costo acumulado de la venta (soporta combos)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_pzs_por_caja := COALESCE((v_item->>'piezas_por_caja')::INT, 6);

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo, COALESCE(es_combo, FALSE)
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod, v_es_combo
        FROM inventario
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        -- Verificar si tiene componentes en producto_componentes
        SELECT EXISTS (SELECT 1 FROM producto_componentes WHERE combo_id = v_producto_id) INTO v_tiene_componentes;

        IF v_es_combo OR v_tiene_componentes THEN
            -- Calcular costo del combo sumando el costo de sus componentes
            v_costo_item := 0.00;
            FOR v_comp IN 
                SELECT pc.componente_id, pc.cantidad, COALESCE(i.costo, 0) as costo_comp
                FROM producto_componentes pc
                JOIN inventario i ON pc.componente_id = i.id
                WHERE pc.combo_id = v_producto_id
            LOOP
                v_cant_comp_req := (v_cant_cajas + v_pzs_sueltas) * v_comp.cantidad;
                v_costo_item := v_costo_item + (v_cant_comp_req * v_comp.costo_comp);
            END LOOP;
        ELSE
            v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);
            IF v_m2_caja > 0 THEN
                v_costo_item := ((v_cant_cajas * v_m2_caja) + (v_pzs_sueltas * (v_m2_caja / v_pzs_por_caja))) * v_costo_unit;
            ELSE
                v_costo_item := v_pzs_sueltas * v_costo_unit;
            END IF;
        END IF;

        v_total_costo := v_total_costo + v_costo_item;
    END LOOP;

    -- Registrar la venta vinculando la sesion_caja_id
    INSERT INTO ventas (codigo_venta, cliente_id, subtotal, descuento, total, total_costo, metodo_pago, estado, nota, sesion_caja_id)
    VALUES (v_codigo_venta, p_cliente_id, p_subtotal, p_descuento, p_total, v_total_costo, p_metodo_pago, p_estado, p_nota, v_sesion_caja_id)
    RETURNING id INTO v_venta_id;

    -- Iteración 2: Registrar ventas_detalle, actualizar stock y Kardex
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_precio_unit := (v_item->>'precio_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo, COALESCE(es_combo, FALSE)
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod, v_es_combo
        FROM inventario
        WHERE id = v_producto_id;

        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        SELECT EXISTS (SELECT 1 FROM producto_componentes WHERE combo_id = v_producto_id) INTO v_tiene_componentes;

        IF p_estado IN ('PAGADO', 'ENTREGADO') THEN
            IF v_es_combo OR v_tiene_componentes THEN
                -- Descontar stock y registrar Kardex de cada componente individual
                FOR v_comp IN 
                    SELECT pc.componente_id, pc.cantidad, i.stock as stock_comp, i.piezas_sueltas as pzs_comp, i.nombre as nombre_comp, i.m2_caja as m2_comp
                    FROM producto_componentes pc
                    JOIN inventario i ON pc.componente_id = i.id
                    WHERE pc.combo_id = v_producto_id
                LOOP
                    v_cant_comp_req := (v_cant_cajas + v_pzs_sueltas) * v_comp.cantidad;

                    IF v_comp.m2_caja > 0 THEN
                        IF v_comp.stock_comp < v_cant_comp_req THEN
                            RAISE EXCEPTION 'Stock insuficiente para el componente % del combo %: stock actual % cjs, requerido % cjs.',
                                v_comp.nombre_comp, v_nombre_prod, v_comp.stock_comp, v_cant_comp_req;
                        END IF;
                        UPDATE inventario 
                        SET stock = stock - v_cant_comp_req
                        WHERE id = v_comp.componente_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (v_comp.componente_id, 'SALIDA', v_cant_comp_req, 0, 'VENTA', v_venta_id);
                    ELSE
                        IF v_comp.stock_comp < v_cant_comp_req THEN
                            RAISE EXCEPTION 'Stock insuficiente para el componente % del combo %: stock actual % unds, requerido % unds.',
                                v_comp.nombre_comp, v_nombre_prod, v_comp.stock_comp, v_cant_comp_req;
                        END IF;
                        UPDATE inventario 
                        SET stock = stock - v_cant_comp_req,
                            piezas_sueltas = 0
                        WHERE id = v_comp.componente_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (v_comp.componente_id, 'SALIDA', 0, v_cant_comp_req, 'VENTA', v_venta_id);
                    END IF;
                END LOOP;
            ELSE
                -- Descuenta producto estándar
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
        END IF;

        INSERT INTO ventas_detalle (venta_id, producto_id, cantidad_cajas, piezas_sueltas, precio_unitario, costo_unitario, subtotal)
        VALUES (v_venta_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_precio_unit, v_costo_unit, v_subtotal_item);

    END LOOP;

    RETURN v_codigo_venta;
END;
$$ LANGUAGE plpgsql;


-- ==========================================
-- SECCIÓN: MULTI-EMPRESA, PAGOS MIXTOS Y CUENTAS POR COBRAR
-- ==========================================

-- 1. TABLA: Empresas (Ledisa Palao vs. Corporación Oviedo)
CREATE TABLE IF NOT EXISTS empresas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL UNIQUE,
    ruc VARCHAR(20),
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Insertar empresas por defecto
INSERT INTO empresas (nombre, ruc) VALUES ('Ledisa (Palao)', '') ON CONFLICT (nombre) DO NOTHING;
INSERT INTO empresas (nombre, ruc) VALUES ('Corporación Oviedo', '') ON CONFLICT (nombre) DO NOTHING;

-- Asignar empresa_id a las tablas existentes
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE cajas_sesiones ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;
ALTER TABLE inventario ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_empresa ON ventas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cajas_empresa ON cajas_sesiones(empresa_id);

-- 2. PAGOS MIXTOS (Split Payments)
CREATE TABLE IF NOT EXISTS venta_pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    metodo_pago VARCHAR(50) NOT NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto >= 0),
    referencia VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venta_pagos_venta ON venta_pagos(venta_id);

-- 3. CUENTAS POR COBRAR Y ABONOS (Ventas a Crédito y Cobro posterior)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) DEFAULT 'PAGADO' CHECK (estado_pago IN ('PAGADO', 'PENDIENTE', 'PAGADO_PARCIAL'));
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS monto_pagado NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12, 2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS venta_abonos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    sesion_caja_id UUID REFERENCES cajas_sesiones(id) ON DELETE SET NULL,
    empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
    monto NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
    metodo_pago VARCHAR(50) NOT NULL,
    referencia VARCHAR(100),
    nota TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_abonos_venta ON venta_abonos(venta_id);
CREATE INDEX IF NOT EXISTS idx_abonos_cliente ON venta_abonos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_abonos_sesion ON venta_abonos(sesion_caja_id);

-- 4. FUNCIÓN RPC: registrar_abono_venta
CREATE OR REPLACE FUNCTION registrar_abono_venta(
    p_venta_id UUID,
    p_monto NUMERIC,
    p_metodo_pago VARCHAR,
    p_referencia VARCHAR DEFAULT NULL,
    p_nota TEXT DEFAULT NULL
) RETURNS NUMERIC AS $$
DECLARE
    v_venta RECORD;
    v_sesion_caja_id UUID;
    v_nuevo_monto_pagado NUMERIC;
    v_nuevo_saldo NUMERIC;
    v_nuevo_estado_pago VARCHAR(20);
BEGIN
    SELECT * INTO v_venta FROM ventas WHERE id = p_venta_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró la venta especificada.';
    END IF;

    IF v_venta.saldo_pendiente <= 0 THEN
        RAISE EXCEPTION 'Esta venta ya no tiene saldo pendiente por cobrar.';
    END IF;

    IF p_monto > v_venta.saldo_pendiente THEN
        RAISE EXCEPTION 'El monto ingresado (S/ %) supera el saldo pendiente (S/ %).', p_monto, v_venta.saldo_pendiente;
    END IF;

    -- Buscar sesión de caja abierta para registrar el abono
    SELECT id INTO v_sesion_caja_id 
    FROM cajas_sesiones 
    WHERE estado = 'ABIERTA' 
    AND (empresa_id IS NULL OR empresa_id = v_venta.empresa_id)
    ORDER BY fecha_apertura DESC 
    LIMIT 1;

    -- Registrar abono
    INSERT INTO venta_abonos (venta_id, cliente_id, sesion_caja_id, empresa_id, monto, metodo_pago, referencia, nota)
    VALUES (p_venta_id, v_venta.cliente_id, v_sesion_caja_id, v_venta.empresa_id, p_monto, p_metodo_pago, p_referencia, p_nota);

    -- Actualizar saldos de la venta
    v_nuevo_monto_pagado := COALESCE(v_venta.monto_pagado, 0.00) + p_monto;
    v_nuevo_saldo := v_venta.total - v_nuevo_monto_pagado;

    IF v_nuevo_saldo <= 0.01 THEN
        v_nuevo_saldo := 0.00;
        v_nuevo_estado_pago := 'PAGADO';
    ELSE
        v_nuevo_estado_pago := 'PAGADO_PARCIAL';
    END IF;

    UPDATE ventas 
    SET monto_pagado = v_nuevo_monto_pagado,
        saldo_pendiente = v_nuevo_saldo,
        estado_pago = v_nuevo_estado_pago
    WHERE id = p_venta_id;

    RETURN v_nuevo_saldo;
END;
$$ LANGUAGE plpgsql;

-- 5. ACTUALIZACIÓN DEL RPC: registrar_venta con Soporte para Empresa, Pagos Mixtos y Crédito
CREATE OR REPLACE FUNCTION registrar_venta(
    p_cliente_id UUID,
    p_subtotal NUMERIC,
    p_descuento NUMERIC,
    p_total NUMERIC,
    p_metodo_pago VARCHAR,
    p_estado VARCHAR,
    p_nota TEXT,
    p_items JSONB,
    p_empresa_id UUID DEFAULT NULL,
    p_estado_pago VARCHAR DEFAULT 'PAGADO',
    p_pagos JSONB DEFAULT NULL
) RETURNS VARCHAR AS $$
DECLARE
    v_venta_id UUID;
    v_codigo_venta VARCHAR(30);
    v_prefix VARCHAR(2);
    v_item JSONB;
    v_pago JSONB;
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
    v_es_combo BOOLEAN;
    v_sesion_caja_id UUID;
    
    v_comp RECORD;
    v_cant_comp_req INT;
    v_tiene_componentes BOOLEAN;

    v_total_pagado NUMERIC := 0.00;
    v_saldo_pend NUMERIC := 0.00;
    v_metodo_pago_final VARCHAR(50);
    v_est_pago_final VARCHAR(20);
BEGIN
    SELECT id INTO v_sesion_caja_id 
    FROM cajas_sesiones 
    WHERE estado = 'ABIERTA' 
    AND (p_empresa_id IS NULL OR empresa_id IS NULL OR empresa_id = p_empresa_id)
    ORDER BY fecha_apertura DESC 
    LIMIT 1;

    IF p_estado = 'COTIZACION' THEN
        v_prefix := 'C-';
        v_est_pago_final := 'PENDIENTE';
    ELSE
        v_prefix := 'V-';
        v_est_pago_final := COALESCE(p_estado_pago, 'PAGADO');
    END IF;

    v_codigo_venta := v_prefix || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_pzs_por_caja := COALESCE((v_item->>'piezas_por_caja')::INT, 6);

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo, COALESCE(es_combo, FALSE)
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod, v_es_combo
        FROM inventario
        WHERE id = v_producto_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto con código % no existe en el inventario.', v_producto_id;
        END IF;

        SELECT EXISTS (SELECT 1 FROM producto_componentes WHERE combo_id = v_producto_id) INTO v_tiene_componentes;

        IF v_es_combo OR v_tiene_componentes THEN
            v_costo_item := 0.00;
            FOR v_comp IN 
                SELECT pc.componente_id, pc.cantidad, COALESCE(i.costo, 0) as costo_comp
                FROM producto_componentes pc
                JOIN inventario i ON pc.componente_id = i.id
                WHERE pc.combo_id = v_producto_id
            LOOP
                v_cant_comp_req := (v_cant_cajas + v_pzs_sueltas) * v_comp.cantidad;
                v_costo_item := v_costo_item + (v_cant_comp_req * v_comp.costo_comp);
            END LOOP;
        ELSE
            v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);
            IF v_m2_caja > 0 THEN
                v_costo_item := ((v_cant_cajas * v_m2_caja) + (v_pzs_sueltas * (v_m2_caja / v_pzs_por_caja))) * v_costo_unit;
            ELSE
                v_costo_item := v_pzs_sueltas * v_costo_unit;
            END IF;
        END IF;

        v_total_costo := v_total_costo + v_costo_item;
    END LOOP;

    IF p_pagos IS NOT NULL AND jsonb_array_length(p_pagos) > 0 THEN
        SELECT COALESCE(SUM((p->>'monto')::NUMERIC), 0.00) INTO v_total_pagado FROM jsonb_array_elements(p_pagos) p;
        IF jsonb_array_length(p_pagos) = 1 THEN
            v_metodo_pago_final := (p_pagos->0->>'metodo_pago');
        ELSE
            v_metodo_pago_final := 'Pago Mixto';
        END IF;
    ELSE
        v_metodo_pago_final := COALESCE(p_metodo_pago, 'Efectivo');
        IF v_est_pago_final = 'PAGADO' THEN
            v_total_pagado := p_total;
        ELSE
            v_total_pagado := 0.00;
        END IF;
    END IF;

    IF v_est_pago_final = 'PENDIENTE' THEN
        v_total_pagado := COALESCE(v_total_pagado, 0.00);
        v_saldo_pend := p_total - v_total_pagado;
    ELSIF v_total_pagado < p_total THEN
        v_saldo_pend := p_total - v_total_pagado;
        IF v_total_pagado > 0 THEN
            v_est_pago_final := 'PAGADO_PARCIAL';
        ELSE
            v_est_pago_final := 'PENDIENTE';
        END IF;
    ELSE
        v_saldo_pend := 0.00;
        v_est_pago_final := 'PAGADO';
    END IF;

    INSERT INTO ventas (
        codigo_venta, cliente_id, subtotal, descuento, total, total_costo, 
        metodo_pago, estado, nota, sesion_caja_id, empresa_id, estado_pago, 
        monto_pagado, saldo_pendiente
    )
    VALUES (
        v_codigo_venta, p_cliente_id, p_subtotal, p_descuento, p_total, v_total_costo, 
        v_metodo_pago_final, p_estado, p_nota, v_sesion_caja_id, p_empresa_id, v_est_pago_final,
        v_total_pagado, v_saldo_pend
    )
    RETURNING id INTO v_venta_id;

    IF p_pagos IS NOT NULL AND jsonb_array_length(p_pagos) > 0 THEN
        FOR v_pago IN SELECT * FROM jsonb_array_elements(p_pagos) LOOP
            INSERT INTO venta_pagos (venta_id, metodo_pago, monto, referencia)
            VALUES (
                v_venta_id, 
                (v_pago->>'metodo_pago'), 
                (v_pago->>'monto')::NUMERIC, 
                (v_pago->>'referencia')
            );
        END LOOP;
    ELSIF v_total_pagado > 0 THEN
        INSERT INTO venta_pagos (venta_id, metodo_pago, monto)
        VALUES (v_venta_id, v_metodo_pago_final, v_total_pagado);
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id');
        v_cant_cajas := COALESCE((v_item->>'cantidad_cajas')::INT, 0);
        v_pzs_sueltas := COALESCE((v_item->>'piezas_sueltas')::INT, 0);
        v_precio_unit := (v_item->>'precio_unitario')::NUMERIC;
        v_subtotal_item := (v_item->>'subtotal')::NUMERIC;

        SELECT stock, piezas_sueltas, nombre, m2_caja, costo, COALESCE(es_combo, FALSE)
        INTO v_stock_actual, v_pzs_actual, v_nombre_prod, v_m2_caja, v_costo_prod, v_es_combo
        FROM inventario
        WHERE id = v_producto_id;

        v_costo_unit := COALESCE((v_item->>'costo_unitario')::NUMERIC, v_costo_prod);

        SELECT EXISTS (SELECT 1 FROM producto_componentes WHERE combo_id = v_producto_id) INTO v_tiene_componentes;

        IF p_estado IN ('PAGADO', 'ENTREGADO') THEN
            IF v_es_combo OR v_tiene_componentes THEN
                FOR v_comp IN 
                    SELECT pc.componente_id, pc.cantidad, i.stock as stock_comp, i.piezas_sueltas as pzs_comp, i.nombre as nombre_comp, i.m2_caja as m2_comp
                    FROM producto_componentes pc
                    JOIN inventario i ON pc.componente_id = i.id
                    WHERE pc.combo_id = v_producto_id
                LOOP
                    v_cant_comp_req := (v_cant_cajas + v_pzs_sueltas) * v_comp.cantidad;

                    IF v_comp.m2_caja > 0 THEN
                        IF v_comp.stock_comp < v_cant_comp_req THEN
                            RAISE EXCEPTION 'Stock insuficiente para el componente % del combo %: stock actual % cjs, requerido % cjs.',
                                v_comp.nombre_comp, v_nombre_prod, v_comp.stock_comp, v_cant_comp_req;
                        END IF;
                        UPDATE inventario 
                        SET stock = stock - v_cant_comp_req
                        WHERE id = v_comp.componente_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (v_comp.componente_id, 'SALIDA', v_cant_comp_req, 0, 'VENTA', v_venta_id);
                    ELSE
                        IF v_comp.stock_comp < v_cant_comp_req THEN
                            RAISE EXCEPTION 'Stock insuficiente para el componente % del combo %: stock actual % unds, requerido % unds.',
                                v_comp.nombre_comp, v_nombre_prod, v_comp.stock_comp, v_cant_comp_req;
                        END IF;
                        UPDATE inventario 
                        SET stock = stock - v_cant_comp_req,
                            piezas_sueltas = 0
                        WHERE id = v_comp.componente_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (v_comp.componente_id, 'SALIDA', 0, v_cant_comp_req, 'VENTA', v_venta_id);
                    END IF;
                END LOOP;
            ELSE
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
                            RAISE EXCEPTION 'Stock insuficiente para % (%): stock actual % cjs, % pzs. Requerido % cjs, % pzs.', 
                                v_nombre_prod, v_producto_id, v_stock_actual, v_pzs_actual, v_cant_cajas, v_pzs_sueltas;
                        END IF;

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
        END IF;

        INSERT INTO ventas_detalle (venta_id, producto_id, cantidad_cajas, piezas_sueltas, precio_unitario, costo_unitario, subtotal)
        VALUES (v_venta_id, v_producto_id, v_cant_cajas, v_pzs_sueltas, v_precio_unit, v_costo_unit, v_subtotal_item);

    END LOOP;


-- ==========================================
-- FUNCIÓN RPC: anular_venta
-- Anula una venta registrada, restituye el stock al inventario
-- (incluyendo componentes si es combo) y registra la bitácora en Kardex.
-- ==========================================
CREATE OR REPLACE FUNCTION anular_venta(
    p_venta_id UUID,
    p_motivo TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_estado VARCHAR(25);
    v_codigo VARCHAR(30);
    v_nota_actual TEXT;
    v_item RECORD;
    v_comp RECORD;
    v_m2_caja NUMERIC;
    v_pzs_por_caja INT;
    v_es_combo BOOLEAN;
    v_tiene_componentes BOOLEAN;
    v_cant_comp_req INT;
    v_nota_anulacion TEXT;
BEGIN
    -- 1. Obtener estado, código y nota de la venta
    SELECT estado, codigo_venta, nota
    INTO v_estado, v_codigo, v_nota_actual
    FROM ventas
    WHERE id = p_venta_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La venta especificada no existe.';
    END IF;

    IF v_estado = 'ANULADO' THEN
        RAISE EXCEPTION 'La venta % ya se encuentra anulada.', v_codigo;
    END IF;

    -- 2. Restituir el stock solo si la venta no era una simple cotización
    IF v_estado IN ('PAGADO', 'ENTREGADO') THEN
        FOR v_item IN 
            SELECT producto_id, cantidad_cajas, piezas_sueltas 
            FROM ventas_detalle 
            WHERE venta_id = p_venta_id
        LOOP
            -- Consultar datos del producto
            SELECT m2_caja, COALESCE(es_combo, FALSE)
            INTO v_m2_caja, v_es_combo
            FROM inventario
            WHERE id = v_item.producto_id;

            v_pzs_por_caja := 6;

            IF FOUND THEN
                SELECT EXISTS (SELECT 1 FROM producto_componentes WHERE combo_id = v_item.producto_id) INTO v_tiene_componentes;

                IF v_es_combo OR v_tiene_componentes THEN
                    -- Devolver stock a cada componente individual
                    FOR v_comp IN 
                        SELECT pc.componente_id, pc.cantidad, i.m2_caja as m2_comp
                        FROM producto_componentes pc
                        JOIN inventario i ON pc.componente_id = i.id
                        WHERE pc.combo_id = v_item.producto_id
                    LOOP
                        v_cant_comp_req := (COALESCE(v_item.cantidad_cajas, 0) + COALESCE(v_item.piezas_sueltas, 0)) * v_comp.cantidad;

                        IF v_comp.m2_comp > 0 THEN
                            UPDATE inventario 
                            SET stock = stock + v_cant_comp_req
                            WHERE id = v_comp.componente_id;

                            INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                            VALUES (v_comp.componente_id, 'ENTRADA', v_cant_comp_req, 0, 'ANULACION_VENTA', p_venta_id);
                        ELSE
                            UPDATE inventario 
                            SET stock = stock + v_cant_comp_req
                            WHERE id = v_comp.componente_id;

                            INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                            VALUES (v_comp.componente_id, 'ENTRADA', 0, v_cant_comp_req, 'ANULACION_VENTA', p_venta_id);
                        END IF;
                    END LOOP;
                ELSE
                    -- Restituir producto estándar
                    IF v_m2_caja > 0 THEN
                        -- Normalizar cajas y piezas sueltas devueltas
                        UPDATE inventario
                        SET stock = stock + COALESCE(v_item.cantidad_cajas, 0) + ((piezas_sueltas + COALESCE(v_item.piezas_sueltas, 0)) / v_pzs_por_caja),
                            piezas_sueltas = (piezas_sueltas + COALESCE(v_item.piezas_sueltas, 0)) % v_pzs_por_caja
                        WHERE id = v_item.producto_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (
                            v_item.producto_id, 
                            'ENTRADA', 
                            COALESCE(v_item.cantidad_cajas, 0), 
                            COALESCE(v_item.piezas_sueltas, 0), 
                            'ANULACION_VENTA', 
                            p_venta_id
                        );
                    ELSE
                        -- Para productos por unidad
                        UPDATE inventario
                        SET stock = stock + COALESCE(v_item.piezas_sueltas, 0)
                        WHERE id = v_item.producto_id;

                        INSERT INTO kardex (producto_id, tipo, cantidad_cajas, piezas_sueltas, motivo, referencia_id)
                        VALUES (
                            v_item.producto_id, 
                            'ENTRADA', 
                            0, 
                            COALESCE(v_item.piezas_sueltas, 0), 
                            'ANULACION_VENTA', 
                            p_venta_id
                        );
                    END IF;
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 3. Marcar la venta como ANULADO y limpiar saldo pendiente / estado de pago
    v_nota_anulacion := COALESCE(v_nota_actual, '') || 
        CHR(10) || '[ANULADO]: ' || COALESCE(p_motivo, 'Anulación de venta');

    UPDATE ventas
    SET estado = 'ANULADO',
        estado_pago = 'ANULADO',
        saldo_pendiente = 0.00,
        nota = TRIM(v_nota_anulacion)
    WHERE id = p_venta_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- MIGRACIÓN: Saldos iniciales de Yape, Tarjeta y Transferencia en Cajas Sesiones
-- ==========================================
ALTER TABLE cajas_sesiones 
ADD COLUMN IF NOT EXISTS monto_apertura_yape NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monto_apertura_tarjeta NUMERIC(12, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS monto_apertura_transferencia NUMERIC(12, 2) DEFAULT 0.00;





