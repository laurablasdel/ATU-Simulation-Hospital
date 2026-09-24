Run with Node.js and jsdom 30.0.1 available on the module path:

```sh
node tests/simulation-workflows.cjs
node tests/workflow-details.cjs
```

The tests use an isolated DOM and simulated shared updates. They do not contact the live database. Physical scanner and printer checks must be performed with classroom hardware.

