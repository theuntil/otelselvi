'use strict';

// Basit çizgi ikonlar (24x24). Görünümde <%- icon('phone') %> ile kullanılır.
const paths = {
  phone:
    '<path d="M5 4h3.5l1.6 4.2-2.1 1.4a11 11 0 0 0 6.4 6.4l1.4-2.1L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4z"/>',
  chat:
    '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z"/><path d="M8 9h8M8 12h5"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="m4 7 8 6 8-6"/>',
  pin: '<path d="M12 21s-6.5-6.1-6.5-11.2a6.5 6.5 0 0 1 13 0C18.5 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  briefcase: '<rect x="3.5" y="7.5" width="17" height="12" rx="1.5"/><path d="M9 7.5V5.8A1.3 1.3 0 0 1 10.3 4.5h3.4A1.3 1.3 0 0 1 15 5.8v1.7M3.5 12.5h17"/>',
  at: '<circle cx="12" cy="12" r="3.5"/><path d="M15.5 12v1.3a2.2 2.2 0 0 0 4.4 0V12a7.9 7.9 0 1 0-3.1 6.3"/>',
  check: '<path d="m5 12.5 4.2 4L19 7"/>',
};

function icon(name, cls = 'icon') {
  const p = paths[name];
  if (!p) return '';
  return `<svg class="${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
}

module.exports = { icon };
