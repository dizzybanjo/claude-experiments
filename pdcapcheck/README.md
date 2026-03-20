# pd_cap_check

A command-line tool that checks whether abstraction names in Pure Data project patches match the capitalisation of the corresponding files in a library folder.

Pure Data loads abstractions by filename. On case-sensitive filesystems (Linux), a capitalisation mismatch will cause a patch to fail silently. This tool finds those mismatches before they become a problem.

## Usage

```
python3 pd_cap_check.py <project_folder> <library_folder> [<library_folder2> ...]
```

- `<project_folder>` — the folder containing your `.pd` patches (scanned recursively)
- `<library_folder>` — one or more folders containing abstraction `.pd` files (each scanned recursively)

### Examples

Single library:
```
python3 pd_cap_check.py project library
```

Multiple libraries:
```
python3 pd_cap_check.py project library extras/shared-abstractions
```

## Output

The report prints to stdout. Failures are listed first, followed by passes, then a summary.

```
============================================================
PURE DATA ABSTRACTION CAPITALISATION REPORT
============================================================
  Project folder : project
  Library folder : library
  Abstractions checked : 8

FAILURES (5)
------------------------------------------------------------
  project/fx/master.pd    line 3    found 'lowpassfilter'  ->  expected 'lowPassFilter'
  project/fx/master.pd    line 5    found 'Reverbunit'     ->  expected 'reverbUnit'
  ...

PASSES (3)
------------------------------------------------------------
  project/synths/main.pd  line 2    'oscBank'  OK
  ...

============================================================
SUMMARY: 8 checked  |  3 passed  |  5 failed
============================================================
```

## Exit codes

| Code | Meaning |
|------|---------|
| `0`  | All abstractions passed |
| `1`  | One or more capitalisation mismatches found |

This makes the tool easy to integrate into a CI pipeline or shell script.

## Notes

- Only `#X obj` lines are parsed — this covers standard object instantiation in `.pd` files
- Built-in Pd objects (e.g. `dac~`, `osc~`, `+`) are ignored automatically; only names that match a file in the library folder are checked
- Both folders are scanned recursively, so nested subfolders are handled

## Test files

The `project/` and `library/` folders in this repository contain sample `.pd` files for testing the tool.
