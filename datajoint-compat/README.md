# DataJoint Compatibility Testing

This module tests assumptions Helium makes when working with schemas generated from Python via DataJoint.

```
$ pip3 install -r requirements.txt
$ python3 create_schema.py
$ python3 test.py
```

What's tested:

 - Class name to SQL name conversion
 - Table tier prefixes
 - Part table naming
