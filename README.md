UCFG JS
=======

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Micro configuration format implemented in JavaScript.

## Configuration Files

Although tempting, using [USON](https://github.com/garnetius/uson-js), JSON, YAML, or any other general-purpose data serialization format for the purpose of configuration isn’t a very good idea. The rigid structure imposed by such formats often reduces readability and strict grammar rules imposed by them make authoring configuration files by hand a less enjoyable experience.

**UCFG** is heavily inspired by **NGINX** configuration file syntax, which proved to be quite a successful one, with just a few additions to enhance human-friendliness.

An example of completely made-up configuration file that can be used with UCFG:

```js
id: local-server;
limit: 1024;

location ~ /(blog|wiki)/ {
  session: on 30m autorenew "backend node37"
    'prefix sess' (inline comment) persistent;
  keep-alive: on;
  index: off;
  cache: on;

  # Comment
  logging {
    file: /var/tmp/log.txt;
    rotate: yes;
    template:
'Clouded Server'
'[Event %d]: %s'
;
  }

  debugging: disabled;
}
```

Sections are represented by tables (`key: value` pairs) and all values are arrays, even if they consist of only one item.

There can always be multiple sections of the same name in a configuration. Duplicate keys, however, are subject to application-defined behavior.

## Default Value

A section name may be followed by a value (which is also an array) terminated with `{`:

```js
location = /public {
}
```

Here everything between `location` and `{` is a default value consisting of two items: `=` and `/public`.

A default value of a section is stored under special key `USON.$`, which cannot be set by any other valid means, including some property inside a section. It’s called “default” because it supposedly holds the most essential option(s) for a given section, possibly highlighting its role and greatly improving readability.

Compare:

```js
server webapp {
}
```

To:

```js
server {
  name: webapp;
}
```

There can only be one default value per section.

It is up to individual application how all values (default or not) are interpreted.

## Running

**UCFG** depends on [USON](https://github.com/garnetius/uson-js):

```bash
git clone https://github.com/garnetius/core-js.git
git clone https://github.com/garnetius/radix-tree-js.git
git clone https://github.com/garnetius/uxml-js.git
git clone https://github.com/garnetius/uson-js.git
git clone https://github.com/garnetius/ucfg-js.git

cd ucfg-js
node index.js example.conf
```
