import datajoint as dj

dj.config["database.host"] = "localhost"
dj.config["database.user"] = "user"
dj.config["database.password"] = "password"

schema_name = "helium_from_dj"
dj.schema(schema_name, locals()).drop(force = True)
schema = dj.schema(schema_name, locals())

sample_def = """
id: int                    # primary key
---
foo: varchar(255)          # some string
bar: date                  # some date
baz: enum('a', 'b', 'c')   # some enum
"""

@schema
class SampleManual(dj.Manual):
    definition = sample_def

@schema
class SampleLookup(dj.Lookup):
    definition = sample_def

@schema
class SampleImported(dj.Imported):
    definition = sample_def

@schema
class SampleComputed(dj.Computed):
    definition = sample_def

@schema
class SampleMaster(dj.Manual):
    definition = """
    id: int
    """

    class Part1(dj.Part):
        definition = """
        part1_id: int
        """
    
    class Part2(dj.Part):
        definition = """
        part2_id: int
        """
