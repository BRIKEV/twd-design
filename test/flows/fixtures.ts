// What the scripted model "writes": small, but shaped like the real prototypes.

export const DESIGN_MD = `# Design — Acme
Primary color: #e4572e (buttons, links). Font: Inter. Every destructive action needs a confirmation.`;

export const LOGIN_V1 = `<!doctype html>
<html><body class="font-[Inter]">
  <main x-data="app()">
    <form @submit.prevent="login()">
      <label>Email <input type="email" required></label>
      <button class="bg-[#e4572e]">Log in</button>
    </form>
  </main>
</body></html>`;

export const INTENT = `# Login

Problem: people can't sign in from the new web app.

## Scenarios
- A registered user signs in and lands on their projects.
- A wrong password shows an error under the form.

<!-- DEV: POST /api/session (proposed) -->`;
