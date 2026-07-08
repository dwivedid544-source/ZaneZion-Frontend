const fs = require('fs');
const path = require('path');
const files = [
  'src/hooks/api/usePlans.js',
  'src/hooks/api/useOrders.js',
  'src/hooks/api/useLogistics.js',
  'src/hooks/api/useFinance.js',
  'src/hooks/api/useCRM.js',
  'src/pages/Common/Payments.jsx'
];

files.forEach(f => {
  const p = path.join('c:/kiaan project/zanzoin-new/frontend', f);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf-8');
  // Handle single quotes
  content = content.replace(/api\.(get|post|put|delete|patch)\('\/api\/v1\//g, "api.$1('/");
  // Handle double quotes
  content = content.replace(/api\.(get|post|put|delete|patch)\("\/api\/v1\//g, 'api.$1("/');
  // Handle backticks
  content = content.replace(/api\.(get|post|put|delete|patch)\(`\/api\/v1\//g, 'api.$1(`/');
  fs.writeFileSync(p, content);
  console.log('Fixed', f);
});
