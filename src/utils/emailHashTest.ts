// utils/emailHashTest.ts

import { createHash } from 'crypto';

function sortObjectRecursively(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sortObjectRecursively);
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj)
        .sort()
        .reduce((result: any, key) => {
          result[key] = sortObjectRecursively(obj[key]);
          return result;
        }, {});
    }
    return obj;
  }

const payload = {
    to: 'alejandro.prado@coretechnology.ie',
    subject: 'Email Test from nodejs',
    body: 'Hello there using OAuth2 and SMTP. With attachments',
    attachments: [
      {
        name: 'PrescriptionAuth_473_20250512_085309.pdf',
        path: '//cul-cor-app01/CoreSoftware/DEV/Dockets/PrescriptionAuth_473_20250512_085309.pdf'
      }
    ]
  };

  const canonical = JSON.stringify(sortObjectRecursively(payload));
const hash = createHash('sha256').update(canonical).digest('hex');
console.log(hash);
