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
CREATE DATABASE helium;

# Select the new database
USE helium;

# Create secondary tables
CREATE TABLE bar(
  bar_pk INTEGER PRIMARY KEY
);
CREATE TABLE baz(
  baz_pk INTEGER PRIMARY KEY
);

# Create primary table
CREATE TABLE foo(
  foo_pk INTEGER PRIMARY KEY,
  `integer` INTEGER COMMENT 'integer column',
  `double` DOUBLE COMMENT 'double column',
  `boolean` BOOLEAN COMMENT 'boolean column',
  `date` DATE COMMENT 'date column',
  `time` TIMESTAMP COMMENT 'time column',
  `enum` ENUM('a', 'b', 'c') NOT NULL COMMENT 'enum column',
  `string` VARCHAR(10) COMMENT 'string column',
  bar INTEGER COMMENT 'bar column',
  baz INTEGER COMMENT 'baz column',
  FOREIGN KEY (bar) REFERENCES bar(bar_pk),
  FOREIGN KEY (baz) REFERENCES baz(baz_pk)
);

# Insert values for foreign key tables
INSERT INTO bar VALUES (0), (5), (10);
INSERT INTO baz VALUES (1), (6), (11);

# Insert values for foo
INSERT INTO foo VALUES
  (0, 10, 20.0, true,  NOW(), NOW(), 'a', 'abc', 0,  1),
  (1, 11, 21.0, true,  NOW(), NOW(), 'b', 'def', 5,  6),
  (2, 12, 22.0, true,  NOW(), NOW(), 'c', 'ghi', 10, 11),
  (3, 13, 23.0, false, NOW(), NOW(), 'a', 'jkl', 0,  1),
  (4, 14, 24.0, false, NOW(), NOW(), 'b', 'mno', 5,  6);
