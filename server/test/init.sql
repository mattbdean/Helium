## Have mysql execute these commands to get the testing environment up and
## running:
## mysql -h 127.0.0.1 -u root -p < init.sql

# Recommended by datajoint
SET GLOBAL sql_mode = 'STRICT_TRANS_TABLES,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';

# (Re-)create the user
DROP USER IF EXISTS 'user'@'%';
CREATE USER 'user'@'%' IDENTIFIED BY 'password';

# Grant necessary privileges to `helium_*` databases
GRANT CREATE,DROP,SELECT,INSERT ON `helium\_%`.* TO 'user'@'%';

# Other DB for cross-schema testing
DROP DATABASE IF EXISTS helium_cross_schema_ref_test;
CREATE DATABASE helium_cross_schema_ref_test CHARACTER SET utf8;

# Ensure an empty database
DROP DATABASE IF EXISTS helium_sample;
CREATE DATABASE helium_sample CHARACTER SET utf8;

# Compound foreign key testing
DROP DATABASE IF EXISTS helium_compound_fk_test;
CREATE DATABASE helium_compound_fk_test CHARACTER SET utf8;

DROP DATABASE IF EXISTS helium_external_form_binding_test;
CREATE DATABASE helium_external_form_binding_test CHARACTER SET utf8;

# Select the new database
USE helium_sample;

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

# Create table with all known supported datatypes (expect for non-null blobs,
# which aren't supported)
CREATE TABLE datatypeshowcase(
  `pk` INTEGER UNSIGNED PRIMARY KEY NOT NULL COMMENT 'pk column',
  `integer` INTEGER UNIQUE COMMENT 'integer column',
  `double` DOUBLE COMMENT 'double column',
  `boolean` BOOLEAN COMMENT 'boolean column',
  `date` DATE COMMENT 'date column',
  `time` TIMESTAMP COMMENT 'time column',
  `enum` ENUM('a', 'b', 'c') COMMENT 'enum column',
  `blob` TINYBLOB COMMENT 'blob column',
  `string` VARCHAR(50) COMMENT 'string column',
  `string_not_null` VARCHAR(50) NOT NULL COMMENT 'string_not_null column'
) COMMENT 'a table with diverse data';

# Table specifically for testing against inserting data with blobs
CREATE TABLE blob_test(
    `pk` INTEGER PRIMARY KEY NOT NULL,
    `blob_nullable` TINYBLOB,
    `blob_not_null` TINYBLOB NOT NULL
);

# Create a few empty schemas for the test of sorting the different types
CREATE TABLE `#test_lookup`(pk INTEGER PRIMARY KEY);
CREATE TABLE _test_imported(pk INTEGER PRIMARY KEY);
CREATE TABLE __test_computed(pk INTEGER PRIMARY KEY);

CREATE TABLE master(pk INTEGER PRIMARY KEY);
CREATE TABLE master__part(
    part_pk INTEGER PRIMARY KEY,
    master INTEGER,
    default_test INTEGER DEFAULT 12345,
    FOREIGN KEY (master) REFERENCES master(pk)
);
CREATE TABLE master__part2(
    part2_pk INTEGER PRIMARY KEY,
    master INTEGER,
    FOREIGN KEY (master) REFERENCES master(pk)
);

CREATE TABLE defaults_test(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT,
    `int` INTEGER DEFAULT 5,
    `float` FLOAT DEFAULT 10.0,
    `date` DATE DEFAULT '2017-01-01',
    `datetime` DATETIME DEFAULT '2017-01-01 12:00:00',
    datetime_now DATETIME DEFAULT CURRENT_TIMESTAMP,
    `boolean` BOOLEAN DEFAULT TRUE,
    `enum` ENUM('a', 'b', 'c') DEFAULT 'a',
    no_default INTEGER
);

CREATE TABLE big_table(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT
);

CREATE TABLE validation_test(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT,
    unsigned_int INTEGER UNSIGNED,
    signed_int INTEGER,
    `float` FLOAT,
    varchar_5 VARCHAR(5),
    autocomplete INTEGER NOT NULL,
    FOREIGN KEY (autocomplete) REFERENCES product(product_id)
);

CREATE TABLE unsubmittable(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT,
    reason BLOB NOT NULL
);

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
  (100, 0,    10.0, 0,    '2017-07-01', '2000-01-01 12:00:00', 'a',  x'1234', 'some string', 'another string'),
  (101, NULL, 11.1, 1,    '2017-07-05', NOW(),                 'b',  NULL,    NULL,          'another string2'),
  (102, 5,    55.5, 0,    '2017-07-05', NOW(),                 'b',  x'1234', NULL,          'another string2'),
  (110, NULL, NULL, NULL, NULL,         NULL,                  NULL, NULL,    NULL,          'mostly null data in this row');

# This data is mostly used for testing SchemaDao.pluck(). pk=1000 has no part table entries, pk=1001 has one entry in
# master__part, and pk=1002 has two entries in master__part and one in master__part2
INSERT INTO master (pk) VALUES (1000), (1001), (1002);
INSERT INTO master__part (part_pk, master) VALUES (100, 1001), (101, 1002), (102, 1002);
INSERT INTO master__part2 (part2_pk, master) VALUES (100, 1002);

DROP PROCEDURE IF EXISTS DO_WHILE;
DELIMITER //
CREATE PROCEDURE DO_WHILE()
    BEGIN
        DECLARE i INT DEFAULT 0;
        WHILE (i < 1000) DO
            INSERT INTO big_table() VALUES ();
            SET i = i + 1;
        END WHILE;
    END;
//

CALL DO_WHILE();

# Create tables for the 2nd schema
USE helium_cross_schema_ref_test;

# The only purpose of this data is that it
CREATE TABLE cross_schema_ref_test(
    pk INTEGER PRIMARY KEY,
    fk INTEGER,
    FOREIGN KEY (fk) REFERENCES helium_sample.order(customer_id)
);

INSERT INTO cross_schema_ref_test(pk, fk) VALUES
    (100, 0),
    (101, 1);

USE helium_compound_fk_test;

CREATE TABLE table_a(
  a_first INTEGER,
  a_second INTEGER,
  a_third INTEGER,
  PRIMARY KEY(a_first, a_second, a_third)
);

CREATE TABLE table_b(
  b_first INTEGER,
  b_second INTEGER,
  b_third INTEGER,
  PRIMARY KEY(b_first, b_second, b_third)
);

CREATE TABLE fk_table(
  pk INTEGER PRIMARY KEY,
  ref_a_first INTEGER,
  ref_a_second INTEGER,
  ref_a_third INTEGER,
  ref_b_first INTEGER,
  ref_b_second INTEGER,
  ref_b_third INTEGER,

  FOREIGN KEY (ref_a_first, ref_a_second, ref_a_third) REFERENCES table_a(a_first, a_second, a_third),
  FOREIGN KEY (ref_b_first, ref_b_second, ref_b_third) REFERENCES table_b(b_first, b_second, b_third)
);

INSERT INTO table_a VALUES
  (1, 2, 3),
  (4, 5, 6),
  (7, 8, 9);

INSERT INTO table_b VALUES
  (101, 102, 103),
  (104, 105, 106),
  (107, 108, 109);

USE helium_external_form_binding_test;

CREATE TABLE master(
    pk INTEGER PRIMARY KEY,
    master_ref INTEGER,
    FOREIGN KEY (master_ref) REFERENCES helium_sample.customer(customer_id)
);

CREATE TABLE master__part(
    pk INTEGER PRIMARY KEY,
    part_ref INTEGER,
    FOREIGN KEY (part_ref) REFERENCES helium_sample.customer(customer_id)
);
