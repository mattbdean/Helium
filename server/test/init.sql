## Have mysql execute these commands to get the testing environment up and
## running:
## mysql -u root -p < init.sql

# Ensure the user exists by creating it
GRANT ALL ON *.* TO 'user'@'localhost' IDENTIFIED BY 'password';
# Drop the newly-created user (the above query can be replaced by DROP USER
# IF EXISTS) with MySQL 5.7
DROP USER 'user'@'localhost';
# Create the user again to ensure that the user exists
GRANT ALL ON helium.* TO 'user'@'localhost' IDENTIFIED BY 'password';

# Ensure an empty database
DROP DATABASE IF EXISTS helium;
CREATE DATABASE helium CHARACTER SET utf8;

# Select the new database
USE helium;

CREATE TABLE customer(
  customer_id INTEGER NOT NULL PRIMARY KEY,
  name VARCHAR(255) NOT NULL
);

CREATE TABLE organization(
  organization_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  ceo_id INTEGER NOT NULL,
  PRIMARY KEY (organization_id, ceo_id),
  FOREIGN KEY (ceo_id) REFERENCES customer(customer_id)
);

CREATE TABLE product(
  product_id INTEGER NOT NULL PRIMARY KEY,
  product_name VARCHAR(255) NOT NULL,
  price DECIMAL(4, 2) NOT NULL
);

CREATE TABLE `order`(
  order_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  confirmation_num INTEGER UNIQUE NOT NULL,
  PRIMARY KEY (order_id, organization_id, customer_id, product_id),
  FOREIGN KEY (organization_id) REFERENCES organization(organization_id),
  FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
  FOREIGN KEY (product_id) REFERENCES product(product_id)
);

CREATE TABLE shipment(
  shipment_id INTEGER NOT NULL PRIMARY KEY,
  order_id INTEGER NOT NULL,
  organization_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  shipped DATE NOT NULL,
  FOREIGN KEY (order_id, organization_id, customer_id, product_id) REFERENCES `order`(order_id, organization_id, customer_id, product_id)
);

# Create table with all known supported datatypes
CREATE TABLE datatypeshowcase(
  `pk` INTEGER PRIMARY KEY NOT NULL COMMENT 'pk column',
  `integer` INTEGER UNIQUE COMMENT 'integer column',
  `double` DOUBLE COMMENT 'double column',
  `boolean` BOOLEAN COMMENT 'boolean column',
  `date` DATE COMMENT 'date column',
  `time` TIMESTAMP COMMENT 'time column',
  `enum` ENUM('a', 'b', 'c') COMMENT 'enum column',
  `string` VARCHAR(50) COMMENT 'string column',
  `string_not_null` VARCHAR(50) NOT NULL COMMENT 'string_not_null column'
) COMMENT 'a table with diverse data';

# A few customers, organizations, and products
INSERT INTO customer VALUES (0, "Some Guy"), (1, "Another Guy");
INSERT INTO organization VALUES (10, "Some Big Company", 0), (11, "Another Big Company", 1);
INSERT INTO product VALUES
  (20, "Chicken breast (1 lb)", 1.99),
  (21, "Apples (1 lb)",         1.99),
  (22, "Soda",                  1.99),
  (23, "Crackers",              3.49),
  (24, "Ice cream",             3.99),
  (25, "Oranges (1 lb)",        2.99),
  (26, "Bananas (1 lb)",        0.79);

# Create a few orders
INSERT INTO `order` (order_id, organization_id, customer_id, product_id, quantity, confirmation_num) VALUES
  (40, 10, 0, 20, 1, 52591),
  (41, 10, 0, 21, 3, 95151),
  (42, 10, 0, 22, 2, 12342),
  (43, 11, 1, 23, 7, 95912),
  (44, 11, 1, 24, 3, 55915),
  (45, 11, 1, 25, 1, 59152),
  (46, 11, 1, 26, 9, 59123),
  (47, 11, 1, 26, 1, 45151);

# Create a shipment for each order
INSERT INTO shipment (shipment_id, order_id, organization_id, customer_id, product_id, shipped) VALUES
  (30, 40, 10, 0, 20, '2017-07-01'),
  (31, 41, 10, 0, 21, '2017-07-03'),
  (32, 42, 10, 0, 22, '2017-07-04'),
  (33, 43, 11, 1, 23, '2017-07-05'),
  (34, 44, 11, 1, 24, '2017-07-06'),
  (35, 45, 11, 1, 25, '2017-07-07'),
  (36, 46, 11, 1, 26, '2017-07-08'),
  (37, 47, 11, 1, 26, '2017-07-09');

# Try to insert data that is as diverse as possible
INSERT INTO datatypeshowcase VALUES
  (100, 0,    10.0, 0,    '2017-07-01', NOW(), 'a',  'some string', 'another string'),
  (101, NULL, 11.1, 1,    '2017-07-05', NOW(), 'b',  NULL,          'another string2'),
  (102, 5,    55.5, 0,    '2017-07-05', NOW(), 'b',  NULL,          'another string2'),
  (110, NULL, NULL, NULL, NULL,         NULL,  NULL, NULL,          'mostly null data in this row');
