/* ================================= $ J $ =====================================
// <ucfg.mjs>
//
// UCFG: Universal Configuration.
//
// Copyright garnetius.
// -------------------------------------------------------------------------- */

"use strict"

import {RadixTree} from "../radix-tree-js/radix-tree.mjs";
import {USON, Stringify} from "../uson-js/uson.mjs";

/* =============================================================================
// Parser
// -------------------------------------------------------------------------- */

class UCFGParser {
get [Symbol.toStringTag]() {
  return "UCFGParser";
}

/* ===--------------------------------------------------------------------------
// Error handler */
parseError (err, pos) {
  this.err = err;
  this.col = pos - this.linePos + 1;
  this.pos = pos + 1;
}

/* ===--------------------------------------------------------------------------
// Character escape sequence: \" */
parseEscapeChar (chr, idx) {
  switch (chr) {
  case '"': break;
  case '\\': break;
  case 'n': chr = '\n'; break;
  case 'r': chr = '\n'; break;
  case 't': chr = '\t'; break;
  default: return this.parseError (UCFG.error.stringEscape, idx);
  }

  this.pos = idx + 1;

  return chr;
}

/* ===--------------------------------------------------------------------------
// Hexadecimal byte escape sequence: \x7f */
parseEscapeHex (idx) {
  const start = idx;
  const len = this.size;
  const ucfg = this.input;

  /* At least two hexadecimal digits must be present */
  if (len - start < 2) {
    return this.parseError (UCFG.error.unexpectedEnd, len);
  }

  /* Get the byte */
  const byte = parseInt (ucfg.substr (start, 2), 16);

  if (Number.isNaN (byte)) {
    return this.parseError (UCFG.error.escapeUnicode, start);
  }

  this.pos = idx + 2;

  return String.fromCodePoint (byte);
}

/* ===--------------------------------------------------------------------------
// Escape sequence: \... */
parseStringEscape (idx) {
  const len = this.size;
  const ucfg = this.input;

  if (idx === len) {
    return this.parseError (UCFG.error.unexpectedEnd, len);
  }

  const chr = ucfg[idx];

  /* Check if this is a hexadecimal escape sequence */
  if (chr === 'x') {
    ++idx;

    if (idx === len) {
      return this.parseError (UCFG.error.unexpectedEnd, len);
    }

    return this.parseEscapeHex (idx);
  }

  /* It's a character escape sequence */
  return this.parseEscapeChar (chr, idx);
}

/* ===--------------------------------------------------------------------------
// Double quoted string: "music" */
parseDouble (idx) {
  let str = "";
  const len = this.size;
  const ucfg = this.input;
  const regex = UCFG.pattern.dqstring;

  while (true) {
    regex.lastIndex = idx;
    const match = regex.exec (ucfg);

    if (match === null) {
      return this.parseError (UCFG.error.unexpectedEnd, len);
    }

    /* Assemble the string */
    const end = match.index;
    str += ucfg.substring (idx, end);
    idx = end;
    const chr = ucfg[idx];

    if (chr === '"') {
      /* End of string */
      this.pos = idx + 1;
      return str;
    } else if (chr === '\\') {
      /* Escape sequence */
      const seq = this.parseStringEscape (idx + 1);

      if (seq === undefined) {
        return;
      }

      str += seq;
    } else {
      /* Control character */
      return this.parseError (UCFG.error.string, idx);
    }

    idx = this.pos;
  }
}

/* ===--------------------------------------------------------------------------
// Single quoted string: 'movie' */
parseSingle (idx) {
  const len = this.size;
  const ucfg = this.input;
  const regex = UCFG.pattern.sqstring;
  regex.lastIndex = idx;
  const match = regex.exec (ucfg);

  if (match === null) {
    return this.parseError (UCFG.error.unexpectedEnd, len);
  }

  const end = match.index;
  const str = ucfg.substring (idx, end);
  idx = end;

  /* Single quoted strings don't support escape sequences */
  const chr = ucfg[idx];

  if (chr === "'") {
    this.pos = idx + 1;
    return str;
  } else {
    return this.parseError (UCFG.error.string, idx);
  }
}

/* ===--------------------------------------------------------------------------
// Identifier: stuff */
parseIdentifier (idx) {
  const start = idx;
  const len = this.size;
  const ucfg = this.input;
  const regex = USON.pattern.identifier;

  if (start === len) {
    return this.parseError (UCFG.error.unexpectedEnd, len);
  }

  let err, end;
  regex.lastIndex = start;
  let match = regex.exec (ucfg);

  if (match === null) {
    err = false;
    end = len;
  } else {
    err = match.index === start;
    end = match.index;
  }

  if (err) {
    return this.parseError (UCFG.error.unexpectedToken, end);
  } else {
    /* Extract the identifier string */
    this.pos = end;
    return ucfg.substring (start, end);
  }
}

/* ===--------------------------------------------------------------------------
// Section: {...} */
parseSection (idx) {
  const len = this.size;
  const ucfg = this.input;
  const map = new RadixTree();

  /* Exclusive set */
  const xset = (map, key, values) => {
    const item = map.get (key);

    if (item !== undefined) {
      return false;
    }

    map.set (key, values);

    return true;
  };

  /* Update or set */
  const upset = (map, key, section) => {
    const item = map.get (key);

    if (item === undefined) {
      map.set (key, [section]);
      return;
    }

    item.push (section);
  };

  while (true) {
    /* Get the key */
    idx = this.skipWspace (idx);

    if (idx === len) {
      if (this.depth !== 0) {
        return this.parseError (UCFG.error.unexpectedEnd, len);
      }

      return map;
    }

    /* Check for object end */
    let key;

    if (this.depth !== 0 && ucfg[idx] === '}') {
      --this.depth;
      this.pos = idx + 1;
      return map;
    } else {
      key = this.parseValue (idx);
    }

    if (key === undefined) {
      return;
    }

    /* Get value(s) */
    let value;
    let values = [];
    let section = true;

    while (true) {
      idx = this.skipWspace (this.pos);

      /* Check for config end */
      if (idx === len) {
        if (this.depth !== 0) {
          return this.parseError (UCFG.error.unexpectedEnd, len);
        }

        if (!xset (map, key, values)) {
          return this.parseError (UCFG.error.keyExists, idx);
        }

        return map;
      }

      /* Check for colon */
      if (ucfg[idx] === ':') {
        if (!section || values.length !== 0) {
          return this.parseError (UCFG.error.unexpectedToken, idx);
        }

        section = false;
        this.pos = ++idx;
      } else if (ucfg[idx] === '}') {
        return this.parseError (UCFG.error.unexpectedToken, idx);
      } else if (ucfg[idx] === '{') {
        if (!section) {
          return this.parseError (UCFG.error.unexpectedToken, idx);
        }

        /* Subsection */
        ++this.depth;
        value = this.parseSection (idx + 1);

        if (value === undefined) {
          return;
        }

        if (values.length !== 0) {
          value.set (USON.$, values);
        }

        /* Multiple sections of the same name are allowed,
        // unlike multiple keys with identical names */
        upset (map, key, value);
        idx = this.pos;
        break;
      } else if (ucfg[idx] === ';') {
        if (section || values.length === 0) {
          return this.parseError (UCFG.error.unexpectedToken, idx);
        }

        if (!xset (map, key, values)) {
          return this.parseError (UCFG.error.keyExists, idx);
        }

        this.pos = ++idx;
        break;
      } else {
        value = this.parseValue (idx);

        if (value === undefined) {
          return;
        }

        values.push (value);
      }
    }
  }
}

/* ===--------------------------------------------------------------------------
// Multiline comment: (...) */
skipCommentMulti (idx) {
  let depth = 1;
  const len = this.size;
  const ucfg = this.input;
  const regex = UCFG.pattern.commentMulti;

  while (true) {
    /* Find where the multiline comment ends */
    regex.lastIndex = idx;
    const match = regex.exec (ucfg);

    if (match === null) {
      return len;
    }

    idx = match.index;
    const chr = ucfg[idx];

    if (chr === '\n') {
      ++idx;
      ++this.line;
      this.linePos = idx;
      continue;
    } else if (chr === '(') {
      /* Nested multiline comment */
      ++depth;
    } else if (chr === ')') {
      /* Multiline comment end */
      ++idx;
      --depth;

      if (depth === 0) {
        return idx;
      }

      continue;
    } else {
      /* Invalid character inside comment */
      return idx;
    }

    ++idx;
  }
}

/* ===--------------------------------------------------------------------------
// Single line comment: #... */
skipCommentSingle (idx) {
  const len = this.size;
  const ucfg = this.input;
  const regex = UCFG.pattern.commentSingle;

  /* Find the end of the line */
  regex.lastIndex = idx;
  const match = regex.exec (ucfg);

  if (match === null) {
    return len;
  }

  idx = match.index;
  const chr = ucfg[idx];

  if (chr === '\n') {
    ++idx;
    ++this.line;
    this.linePos = idx;
  }

  return idx;
}

/* ===--------------------------------------------------------------------------
// Skip whitespace and comments */
skipWspace (idx) {
  const len = this.size;
  const ucfg = this.input;
  const regex = UCFG.pattern.wspace;

  while (true) {
    regex.lastIndex = idx;
    const match = regex.exec (ucfg);

    if (match === null) {
      idx = len;
      break;
    }

    /* Check if any whitespace have been skipped */
    idx = match.index;
    let chr = ucfg[idx];

    if (chr === '\n') {
      /* Track the line and column numbers */
      ++idx;
      ++this.line;
      this.linePos = idx;
      continue;
    } else if (chr === '#') {
      /* Single line comment */
      idx = this.skipCommentSingle (idx + 1);
      continue;
    } else if (chr === '(') {
      /* Multiline comment */
      idx = this.skipCommentMulti (idx + 1);
      continue;
    }

    break;
  }

  return idx;
}

/* ===--------------------------------------------------------------------------
// Parse the value */
parseValue (idx) {
  switch (this.input[idx]) {
  case '"': return this.parseDouble (idx + 1);
  case "'": return this.parseSingle (idx + 1);
  default:  return this.parseIdentifier (idx);
  }
}

/* ===--------------------------------------------------------------------------
// Parse the input */
parse() {
  return this.parseSection (this.pos);
}

/* ===--------------------------------------------------------------------------
// Initialize the parser */
constructor (input) {
  Object.defineProperties (this, {
    input: {value: input},
    size:  {value: input.length},
    err:   {value: UCFG.error.ok, writable: true},
    end:   {value: false, writable: true},
    line:  {value: 1, writable: true},
    col:   {value: 0, writable: true},
    linePos: {value: 0, writable: true},
    pos:   {value: 0, writable: true},
    depth: {value: 0, writable: true}
  });
}}

/* =============================================================================
// Formatter
// -------------------------------------------------------------------------- */

class UCFGFormatter {
get [Symbol.toStringTag]() {
  return "UCFGFormatter";
}

/* ===--------------------------------------------------------------------=== */

stringifyNumber (num) {
  this.output += Stringify.number (num);
}

stringifyBoolean (bool) {
  this.output += Stringify.boolean (bool);
}

stringifyNull() {
  this.output += Stringify.null();
}

stringifyUndefined() {
  this.output += Stringify.undefined();
}

/* ===--------------------------------------------------------------------=== */

stringifyString (str) {
  let out = '"';
  let idx = 0;
  const regex = UCFG.pattern.dqstring;

  while (true) {
    /* Find the next non-string character */
    const match = regex.exec (str);

    if (match === null) {
      /* Output the rest of the string as is */
      out += str.substring (idx);
      break;
    }

    /* Output the part of the string before
    // the offending character */
    const end = match.index;
    out += str.substring (idx, end);

    /* Output the proper escape sequence */
    const chr = str[end];

    switch (chr) {
    case '"':
      out += "\\\"";
      break;
    case '\\':
      out += "\\\\";
      break;
    case '\t':
      out += "\\t";
      break;
    case '\n':
      out += "\\n";
      break;
    default:
      out += "\\x" + chr.charCodeAt(0).toString (16).toLowerCase();
    }

    idx = regex.lastIndex;
  }

  this.output += out + '"';
}

stringifyIdentifier (ident) {
  this.output += ident;
}

stringifyStringAny (key) {
  if (USON.isIdentifier (key)) this.stringifyIdentifier (key);
  else this.stringifyString (key);
}

/* ===--------------------------------------------------------------------=== */

stringifyK (key) {
  this.stringifyIndent();
  this.stringifyStringAny (key);
}

stringifyKC (key) {
  this.stringifyK (key);
  this.output += ':';
}

stringifyKey (key) {
  this.stringifyK (key);
  this.output += ": ";
}

stringifyValues (arr) {
  for (let idx = 0; idx !== arr.length; ++idx) {
    this.stringifyValue (arr[idx], true);

    if (idx !== arr.length - 1) {
      this.output += ' ';
    }
  }
}

stringifyValue (val, inArr) {
  switch (typeof val) {
  case "object":
    if (val instanceof String) {
      this.stringifyStringAny (val.valueOf());
    } else if (val instanceof Number) {
      this.stringifyNumber (val.valueOf());
    } else if (val instanceof Boolean) {
      this.stringifyBoolean (val.valueOf());
    } else if (val === null) {
      this.stringifyNull();
    } else {
      this.stringifyUndefined();
    }

    break;
  case "string":
    this.stringifyStringAny (val);
    break;
  case "number":
    this.stringifyNumber (val);
    break;
  case "boolean":
    this.stringifyBoolean (val);
    break;
  default:
    this.stringifyUndefined();
  }
}

stringifyKV (key, values) {
  this.stringifyKey (key);
  this.stringifyValues (values);
  this.output += ';';
}

/* ===--------------------------------------------------------------------=== */

beginSection (name, values) {
  if (name !== undefined) {
    this.stringifyIndent();
    this.stringifyStringAny (name);
    this.output += ' ';

    if (values !== undefined) {
      this.stringifyValues (values);
      this.output += ' ';
    }
  }

  this.output += '{';
  this.output += '\n';
  ++this.depth;
}

endSection (last) {
  --this.depth;
  this.output += '\n';
  this.stringifyIndent();
  this.output += '}';

  if (!last) {
    this.output += '\n';
  }
}

stringifySection (map) {
  const items = map.entries();
  let idx = 0;

  for (let [key, val] of items) {
    if (val[0] instanceof Map) {
      let i = 0;

      for (let v of val) {
        this.beginSection (key, v[USON.$]);
        this.stringifySection (v);
        this.endSection (++i === v.size);
      }
    } else {
      this.stringifyKV (key, val);
    }

    if (idx !== map.size - 1) {
      this.output += '\n';
    }

    ++idx;
  }
}

/* ===--------------------------------------------------------------------------
// Generate the indentation for the specified depth */
stringifyIndent() {
  this.output += ' '.repeat (this.depth * this.indent);
}

/* ===--------------------------------------------------------------------------
// Format the value */
stringify() {
  if (this.value === undefined) {
    const parser = new UCFGParser(this.output);

    if (parser.parse() === undefined) {
      throw new SyntaxError();
    }

    const out = this.output;
    delete this.output;
    return out;
  } else {
    this.stringifySection (this.value, 0);
    delete this.value;
    return this.output;
  }
}

/* ===--------------------------------------------------------------------------
// Initialize the formatter */
constructor (value, indent=2) {
  switch (indent) {
  case 8: break;
  case 4: break;
  case 3: break;
  case 2: break;
  case 1: break;
  default: throw new RangeError();
  }

  Object.defineProperties (this, {
    indent: {value: indent},
    depth:  {value: 0, writable: true},
    output: {value: "", writable: true},
    value:  {value: value, writable: true, configurable: true}
  });
}}

/* =============================================================================
// Main interface
// -------------------------------------------------------------------------- */

const UCFG = new Object();

Object.defineProperties (UCFG, {
  [Symbol.toStringTag]: {get: () => "UCFG"},

  /* ===-------------------------------
  // Emulate `USON.parse()` behavior */
  parse: {value: (input) => {
    const parser = new UCFGParser(input);
    const root = parser.parse();

    if (root === undefined) {
      throw new SyntaxError ('[' + UCFG.errorStr[parser.err] + ']'
      + ' ' + parser.line + ':' + parser.col);
    }

    return root;
  }},

  /* ===-----------------------------------
  // Emulate `USON.stringify()` behavior */
  stringify: {value: (value, indent) => {
    return new UCFGFormatter(value, indent).stringify();
  }},

  pattern: {value: {
    dqstring: /[\x00-\x1f\\"\x7f]/g,
    sqstring: /[\x00-\x1f'\x7f]/g,
    commentMulti: /[\x00-\x08\x0a-\x0c\x0e-\x1f()\x7f]/g,
    commentSingle: /[\x00-\x08\x0a-\x0c\x0e-\x1f\x7f]/g,
    wspace: /[^\x09\x0d\x20]/g
  }},

  /* Error constants */
  error: {value: {
    ok: 0,
    number: 1,
    string: 2,
    stringEscape: 3,
    escapeUnicode: 4,
    unexpectedToken: 5,
    unexpectedEnd: 6
  }},

  /* Error strings */
  errorStr: {value: [
    "OK",
    "Number",
    "String",
    "Escape",
    "Unicode",
    "Token",
    "End"
  ]}
});

/* ===--------------------------------------------------------------------------
// Exports */
export {
  UCFG,
  UCFGParser,
  UCFGFormatter
}

/* ===------------------------------- {U} --------------------------------=== */
