-- 创建产品表
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10, 2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户表
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    country VARCHAR(50),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建订单表
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    order_date DATE DEFAULT CURRENT_DATE
);

-- 插入产品数据
INSERT INTO products (name, category, price, stock) VALUES
('iPhone 15 Pro', '电子产品', 7999.00, 50),
('MacBook Air M2', '电子产品', 8499.00, 30),
('Sony WH-1000XM5', '配件', 2499.00, 100),
('iPad Pro 11', '电子产品', 6799.00, 40),
('Magic Mouse', '配件', 599.00, 200),
('Logitech MX Master 3S', '配件', 899.00, 150);

-- 插入用户数据
INSERT INTO users (username, email, country) VALUES
('alice', 'alice@example.com', '中国'),
('bob', 'bob@example.com', '美国'),
('charlie', 'charlie@example.com', '英国'),
('david', 'david@example.com', '德国'),
('eve', 'eve@example.com', '中国');

-- 插入订单数据
INSERT INTO orders (user_id, product_id, quantity, total_price, order_date) VALUES
(1, 1, 1, 7999.00, '2024-04-01'),
(1, 3, 2, 4998.00, '2024-04-05'),
(2, 2, 1, 8499.00, '2024-04-10'),
(3, 4, 1, 6799.00, '2024-04-12'),
(4, 5, 1, 599.00, '2024-04-15'),
(5, 1, 1, 7999.00, '2024-04-20'),
(5, 6, 2, 1798.00, '2024-04-22'),
(1, 2, 1, 8499.00, '2024-04-25');
