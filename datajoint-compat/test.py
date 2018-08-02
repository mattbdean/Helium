import unittest
import pymysql.cursors

# Not a Python dev, this is probably pretty ugly

class TestDjConventions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conn = pymysql.connect(
            host="localhost",
            user="user",
            password="password",
            db="helium_from_dj"
        )
    
    @classmethod
    def tearDownClass(cls):
        cls.conn.close()
    
    def test_class_names(self):
        expected_names = [
            "sample_manual",
            "#sample_lookup",
            "_sample_imported",
            "__sample_computed",
            "sample_master",
            "sample_master__part1",
            "sample_master__part2"
        ]
        with TestDjConventions.conn.cursor() as cursor:
            cursor.execute("SHOW TABLES;")
            tables = [row[0] for row in cursor.fetchall()]
            for expected_name in expected_names:
                self.assertIn(expected_name, tables)

if __name__ == "__main__":
    unittest.main()
