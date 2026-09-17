import fs from 'node:fs';

const path = 'src/features/projects/project-readonly-view.tsx';
let text = fs.readFileSync(path, 'utf8');

const oldHead = `    const recovered = await reloadCanonicalSnapshot();\n    // A successful canonical fetch is synchronized into the existing SVAR instance.\n    // Remount only when the fetch itself failed and the last confirmed React snapshot\n    // must be used to discard an unconfirmed local drag/resize.\n    if (!recovered) setGanttResetGeneration((generation) => generation + 1);\n`;
const newHead = `    const recovered = await reloadCanonicalSnapshot();\n    // Preserve recovery failure separately, but publish it before the primary mutation\n    // error so the visible toast remains the save/delete failure the user acted on.\n    if (!recovered && status !== 412) notify("error", "최신 일정 조회에 실패하여 마지막으로 확인한 일정으로 복구했습니다. 다시 조회해 주세요.", "일정 복구");\n    // A successful canonical fetch is synchronized into the existing SVAR instance.\n    // Remount only when the fetch itself failed and the last confirmed React snapshot\n    // must be used to discard an unconfirmed local drag/resize.\n    if (!recovered) setGanttResetGeneration((generation) => generation + 1);\n`;
const oldTail = `    notify("error", message, operation, error);\n    if (!recovered && status !== 412) notify("error", "최신 일정 조회에 실패하여 마지막으로 확인한 일정으로 복구했습니다. 다시 조회해 주세요.", "일정 복구");\n    return message;\n`;
const newTail = `    notify("error", message, operation, error);\n    return message;\n`;

if (text.split(oldHead).length - 1 !== 1) throw new Error('Expected one recovery head block');
if (text.split(oldTail).length - 1 !== 1) throw new Error('Expected one recovery tail block');
text = text.replace(oldHead, newHead).replace(oldTail, newTail);
fs.writeFileSync(path, text);
