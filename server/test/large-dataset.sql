## Assumes init.sql has been successfully run

DROP DATABASE IF EXISTS helium_big_data;
CREATE DATABASE helium_big_data CHARACTER SET utf8;
GRANT ALL ON helium_big_data.* TO 'user'@'%';

USE helium_big_data;

CREATE TABLE mixed(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT,
    `int` INTEGER NOT NULL,
    `boolean` BOOLEAN NOT NULL
);

CREATE TABLE autocomplete_test(
    pk INTEGER PRIMARY KEY AUTO_INCREMENT,
    ref INTEGER NOT NULL,
    FOREIGN KEY (ref) REFERENCES mixed(pk)
);



DROP PROCEDURE IF EXISTS DO_WHILE;
DELIMITER //
CREATE PROCEDURE DO_WHILE()
    BEGIN
        DECLARE i INT DEFAULT 0;
        WHILE (i < 100000) DO
            INSERT INTO mixed(`int`, `boolean`) VALUES
                (FLOOR(RAND() * 100000000), ROUND(RAND()));
            SET i = i + 1;
        END WHILE;
    END;
//

CALL DO_WHILE();
