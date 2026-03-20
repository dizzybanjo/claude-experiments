#!/usr/bin/env python3
"""
pd_cap_check.py — Pure Data abstraction capitalisation checker

Usage:
    python pd_cap_check.py <project_folder> <library_folder>
"""

import os
import sys


def find_pd_files(folder):
    """Recursively find all .pd files under folder."""
    matches = []
    for root, _, files in os.walk(folder):
        for f in files:
            if f.endswith(".pd"):
                matches.append(os.path.join(root, f))
    return sorted(matches)


def build_library_index(library_folder):
    """
    Return a dict mapping lowercase-name -> true-case-name
    for every .pd file found in library_folder.
    """
    index = {}
    for path in find_pd_files(library_folder):
        name = os.path.splitext(os.path.basename(path))[0]
        index[name.lower()] = name
    return index


def extract_objects(pd_file):
    """
    Parse a .pd file and return a list of (line_number, object_name)
    for every '#X obj' line found.
    """
    objects = []
    try:
        with open(pd_file, "r", encoding="utf-8", errors="replace") as f:
            for lineno, line in enumerate(f, start=1):
                tokens = line.split()
                # Pure Data object lines: #X obj <x> <y> <name> [args...];
                if len(tokens) >= 5 and tokens[0] == "#X" and tokens[1] == "obj":
                    obj_name = tokens[4].rstrip(";")
                    objects.append((lineno, obj_name))
    except OSError as e:
        print(f"  WARNING: could not read {pd_file}: {e}", file=sys.stderr)
    return objects


def check_project(project_folder, library_index):
    """
    Scan all project .pd files and cross-reference against library_index.
    Returns (failures, passes) where each entry is a dict with keys:
        file, line, found, expected
    """
    failures = []
    passes = []

    for pd_file in find_pd_files(project_folder):
        for lineno, obj_name in extract_objects(pd_file):
            key = obj_name.lower()
            if key not in library_index:
                continue  # not a library abstraction, skip
            expected = library_index[key]
            entry = {
                "file": pd_file,
                "line": lineno,
                "found": obj_name,
                "expected": expected,
            }
            if obj_name == expected:
                passes.append(entry)
            else:
                failures.append(entry)

    return failures, passes


def print_report(failures, passes, project_folder, library_folder):
    total = len(failures) + len(passes)

    print("=" * 60)
    print("PURE DATA ABSTRACTION CAPITALISATION REPORT")
    print("=" * 60)
    print(f"  Project folder : {project_folder}")
    print(f"  Library folder : {library_folder}")
    print(f"  Abstractions checked : {total}")
    print()

    # --- Failures ---
    print(f"FAILURES ({len(failures)})")
    print("-" * 60)
    if failures:
        # Determine column width for alignment
        max_file_len = max(len(e["file"]) for e in failures)
        for e in failures:
            print(
                f"  {e['file']:{max_file_len}}  line {e['line']:<5}"
                f"  found '{e['found']}'  ->  expected '{e['expected']}'"
            )
    else:
        print("  None")
    print()

    # --- Passes ---
    print(f"PASSES ({len(passes)})")
    print("-" * 60)
    if passes:
        max_file_len = max(len(e["file"]) for e in passes)
        for e in passes:
            print(
                f"  {e['file']:{max_file_len}}  line {e['line']:<5}"
                f"  '{e['found']}'  OK"
            )
    else:
        print("  None")
    print()

    # --- Summary ---
    print("=" * 60)
    print(
        f"SUMMARY: {total} checked  |  {len(passes)} passed  |  {len(failures)} failed"
    )
    print("=" * 60)


def main():
    if len(sys.argv) != 3:
        print("Usage: python pd_cap_check.py <project_folder> <library_folder>")
        sys.exit(1)

    project_folder = sys.argv[1]
    library_folder = sys.argv[2]

    for folder, label in [(project_folder, "project"), (library_folder, "library")]:
        if not os.path.isdir(folder):
            print(f"Error: {label} folder not found: {folder}")
            sys.exit(1)

    library_index = build_library_index(library_folder)
    if not library_index:
        print(f"Warning: no .pd files found in library folder: {library_folder}")

    failures, passes = check_project(project_folder, library_index)
    print_report(failures, passes, project_folder, library_folder)

    # Exit with non-zero code if there are failures (useful for CI)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
