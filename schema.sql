-- schema.sql
-- مخطط قاعدة البيانات لمشروع "ختم - Khatm" (PostgreSQL / Supabase)
-- جاهز للتشغيل الفعلي ومبني ليدعم العزل الأمني الكامل للمنشآت (Multi-Tenant Isolation)

-- 1. جدول خطط الاشتراكات (Plans)
CREATE TABLE IF NOT EXISTS plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    max_customers INT NOT NULL, -- -1 لغير المحدود
    max_branches INT NOT NULL,  -- -1 لغير المحدود
    max_staff INT NOT NULL,     -- -1 لغير المحدود
    max_notifications INT NOT NULL, -- شهرياً
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- إدراج الخطط المعتمدة
INSERT INTO plans (id, name, price_monthly, max_customers, max_branches, max_staff, max_notifications)
VALUES
('free', 'الخطة المجانية', 0.00, 100, 1, 1, 100)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    max_customers = EXCLUDED.max_customers,
    max_branches = EXCLUDED.max_branches,
    max_staff = EXCLUDED.max_staff,
    max_notifications = EXCLUDED.max_notifications;

INSERT INTO plans (id, name, price_monthly, max_customers, max_branches, max_staff, max_notifications)
VALUES
('growth', 'خطة النمو', 85.00, -1, 3, 5, 5000)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    max_customers = EXCLUDED.max_customers,
    max_branches = EXCLUDED.max_branches,
    max_staff = EXCLUDED.max_staff,
    max_notifications = EXCLUDED.max_notifications;

INSERT INTO plans (id, name, price_monthly, max_customers, max_branches, max_staff, max_notifications)
VALUES
('premium', 'الخطة الاحترافية البريميوم', 149.00, -1, -1, -1, -1)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly = EXCLUDED.price_monthly,
    max_customers = EXCLUDED.max_customers,
    max_branches = EXCLUDED.max_branches,
    max_staff = EXCLUDED.max_staff,
    max_notifications = EXCLUDED.max_notifications;


-- 2. جدول التجار (Merchants)
CREATE TABLE IF NOT EXISTS merchants (
    id VARCHAR(100) PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    plan_id VARCHAR(50) REFERENCES plans(id) DEFAULT 'free',
    status VARCHAR(50) NOT NULL DEFAULT 'trial', -- trial, active, suspended
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 3. جدول الفروع (Branches)
CREATE TABLE IF NOT EXISTS branches (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    qr_code_value VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 4. جدول الموظفين (Merchant Staff)
CREATE TABLE IF NOT EXISTS merchant_staff (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE,
    branch_id VARCHAR(100) REFERENCES branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_owner BOOLEAN NOT NULL DEFAULT false,
    can_stamp BOOLEAN NOT NULL DEFAULT true,
    can_enroll_customer BOOLEAN NOT NULL DEFAULT true,
    can_view_reports BOOLEAN NOT NULL DEFAULT false,
    can_manage_settings BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 5. جدول قوالب بطاقات الولاء (Loyalty Cards Template)
CREATE TABLE IF NOT EXISTS loyalty_cards (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE UNIQUE,
    brand_name VARCHAR(255) NOT NULL,
    program_name VARCHAR(255) NOT NULL,
    logo_url TEXT,
    hex_background_color VARCHAR(10) NOT NULL DEFAULT '#1E3050',
    stamps_goal INT NOT NULL DEFAULT 10,
    stamp_emoji VARCHAR(10) NOT NULL DEFAULT '☕',
    reward_name VARCHAR(255) NOT NULL,
    cooldown_minutes INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- 6. جدول العملاء المشتركين (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    stamps_collected INT NOT NULL DEFAULT 0,
    stamps_goal INT NOT NULL DEFAULT 10,
    last_stamped_time TIMESTAMP WITH TIME ZONE,
    rewards_claimed INT NOT NULL DEFAULT 0,
    enrollment_source VARCHAR(50) NOT NULL DEFAULT 'manual', -- manual, self_qr
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_merchant_customer_phone UNIQUE (merchant_id, phone)
);


-- 7. جدول سجلات الحركة والأختام (Stamps Log)
CREATE TABLE IF NOT EXISTS stamps_log (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE,
    customer_id VARCHAR(100) REFERENCES customers(id) ON DELETE CASCADE,
    staff_id VARCHAR(100) REFERENCES merchant_staff(id) ON DELETE SET NULL,
    branch_id VARCHAR(100) REFERENCES branches(id) ON DELETE SET NULL,
    customer_name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- stamp, redeem, enroll, push
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details TEXT
);


-- 8. جدول سجلات الإشعارات (Notifications Log)
CREATE TABLE IF NOT EXISTS notifications_log (
    id VARCHAR(100) PRIMARY KEY,
    merchant_id VARCHAR(100) REFERENCES merchants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ==================================================
-- الدوال البرمجية المخزنة (Stored Functions)
-- ==================================================

-- 1. دالة إضافة ختم للعميل (add_stamp)
CREATE OR REPLACE FUNCTION add_stamp(
    p_customer_id VARCHAR,
    p_staff_id VARCHAR,
    p_branch_id VARCHAR
)
RETURNS JSON AS $$
DECLARE
    v_customer_record RECORD;
    v_staff_record RECORD;
    v_card_record RECORD;
    v_cooldown_seconds INT;
    v_now TIMESTAMP WITH TIME ZONE;
    v_new_stamps INT;
    v_stamps_goal INT;
    v_is_reward BOOLEAN := false;
    v_log_id VARCHAR;
BEGIN
    v_now := CURRENT_TIMESTAMP;
    v_log_id := 'log_' || extract(epoch from v_now)::bigint || '_' || floor(random() * 1000)::int;

    -- جلب سجل العميل
    SELECT * INTO v_customer_record FROM customers WHERE id = p_customer_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'العميل غير موجود');
    END IF;

    -- جلب سجل الموظف
    SELECT * INTO v_staff_record FROM merchant_staff WHERE id = p_staff_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'الموظف غير موجود');
    END IF;

    -- التحقق من تطابق التاجر (أمان عزل البيانات)
    IF v_customer_record.merchant_id <> v_staff_record.merchant_id THEN
        RETURN json_build_object('success', false, 'error', 'العميل لا ينتمي إلى منشأة الموظف');
    END IF;

    -- جلب قالب البطاقة للتحقق من Cooldown والـ Stamps Goal
    SELECT * INTO v_card_record FROM loyalty_cards WHERE merchant_id = v_customer_record.merchant_id;
    v_stamps_goal := COALESCE(v_card_record.stamps_goal, 10);
    v_cooldown_seconds := COALESCE(v_card_record.cooldown_minutes, 1) * 60;

    -- فحص الحماية ضد الاحتيال (Cooldown)
    IF v_customer_record.last_stamped_time IS NOT NULL THEN
        IF EXTRACT(EPOCH FROM (v_now - v_customer_record.last_stamped_time)) < v_cooldown_seconds THEN
            RETURN json_build_object(
                'success', false,
                'error', 'حماية ضد الاحتيال مفعّلة: يرجى الانتظار قليلاً قبل الختم مرة أخرى',
                'seconds_remaining', CEIL(v_cooldown_seconds - EXTRACT(EPOCH FROM (v_now - v_customer_record.last_stamped_time)))
            );
        END IF;
    END IF;

    -- تحديث العداد
    v_new_stamps := v_customer_record.stamps_collected + 1;

    IF v_new_stamps >= v_stamps_goal THEN
        v_is_reward := true;
    END IF;

    -- تحديث قاعدة البيانات للعميل
    UPDATE customers
    SET stamps_collected = v_new_stamps,
        last_stamped_time = v_now
    WHERE id = p_customer_id;

    -- تسجيل الحركة في Stamps Log
    INSERT INTO stamps_log (id, merchant_id, customer_id, staff_id, branch_id, customer_name, type, timestamp, details)
    VALUES (
        v_log_id,
        v_customer_record.merchant_id,
        p_customer_id,
        p_staff_id,
        p_branch_id,
        v_customer_record.name,
        'stamp',
        v_now,
        'تم إضافة ختم بنجاح. المجموع الحالي: ' || v_new_stamps || ' من ' || v_stamps_goal
    );

    RETURN json_build_object(
        'success', true,
        'stamps_collected', v_new_stamps,
        'stamps_goal', v_stamps_goal,
        'is_reward', v_is_reward,
        'customer_name', v_customer_record.name
    );
END;
$$ LANGUAGE plpgsql;


-- 2. دالة التحقق من حدود الخطة (can_add_customer)
CREATE OR REPLACE FUNCTION can_add_customer(
    p_merchant_id VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
    v_merchant_record RECORD;
    v_plan_record RECORD;
    v_current_customers_count INT;
BEGIN
    -- جلب سجل التاجر والخطة المشترك بها
    SELECT * INTO v_merchant_record FROM merchants WHERE id = p_merchant_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    SELECT * INTO v_plan_record FROM plans WHERE id = v_merchant_record.plan_id;
    IF NOT FOUND THEN
        RETURN false;
    END IF;

    -- إذا كانت حدود الخطة غير محدودة (-1)
    IF v_plan_record.max_customers = -1 THEN
        RETURN true;
    END IF;

    -- حساب عدد العملاء الحاليين للتاجر
    SELECT COUNT(*) INTO v_current_customers_count FROM customers WHERE merchant_id = p_merchant_id;

    -- التحقق من السقف المسموح به
    IF v_current_customers_count < v_plan_record.max_customers THEN
        RETURN true;
    ELSE
        RETURN false;
    END IF;
END;
$$ LANGUAGE plpgsql;
