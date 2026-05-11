const selectedColumns = new Set(['name']);
const p = { name: 'Mike', email: 'mike@example.com', phone: '123' };
const event = { eventType: 'fixed' };
const details = [];
if (selectedColumns.has('email') && p.email) details.push(p.email);
if (selectedColumns.has('phone') && p.phone) details.push(p.phone);
console.log('details:', details);
