import { profile } from './content/profile';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <main>
    <h1>${profile.name}</h1>
    <p>${profile.role}</p>
    <p>Liquid Aero redesign under construction. See ROADMAP.md.</p>
  </main>
`;
