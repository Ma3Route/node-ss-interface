
# Change Log

All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).


## Unreleased


## 0.3.0 - 19/03/2016

Added:

* module `Collection` for managing server caches

Fixed:

* error in `Server#addOne` in Node 0.10


## 0.2.0 - 11/03/2016

Changed:

* use [json-stable-stringify](https://github.com/substack/json-stable-stringify)
  to convert objects into strings.

Fixed:

* make `id` in `server#addOne` optional


## 0.1.0 - 17/02/2016

Added:

* add `Server#removeOne` function (7b16f85c847442cb8c414837f2f6e2be783797d0)


## 0.0.1 -11/02/2016

Fixed:

* fix getting older items with non-successive IDs (e0a308d011f398f1d21922b384e123a918b4003f)


## 0.0.0

This is the very first version.
