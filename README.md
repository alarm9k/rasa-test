# What is this repo.
This is the coding challenge I was asked to do at Rasa.

# How to run.
- `yarn install` to install dependencies.
- `yarn start` to launch webpack dev server on port 3000.

# What was changed.
This is what was possible to do in reasonable time.
- Cleaned up the code.
- Switched to Typescript to avoid silly mistakes more easily. Typescript compiles to ES2019 (to have Array.flat()). In real life we would be slightly more concerned about compatibility.
- Highlighting text creates a single div for all entities instead of multiple copies of the same text. Fully rewritten.
- Text can be added/deleted by typing or copy/pasting inside or outside existing entities. Rewritten from scratch.
- Overlapping entities are just painted green (instead of RGB color mixing).
