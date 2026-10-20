# The catalogue site

`stackledger build` turns a catalogue folder into two static websites: `full/` for the people allowed to see costs and contracts, and `staff/` for everyone else.

```sh
stackledger build ./catalogue --out ./public --date 2027-06-01
```

## Publishing the output

The output folder holds more than the two sites while a build runs: the build prepares everything in a staging folder `.stackledger-tmp-*` inside it, and that staging folder holds `full` view files outside the protected `/full/` path.

- Never serve the output folder while a build runs, and never serve the output folder itself.
- Publish only these four entries of the output folder: `full/`, `staff/`, `_headers` and `robots.txt`, and only after the command exits with code 0.
