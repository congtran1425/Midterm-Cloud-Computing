export const collectDefinedFields = (body, fieldMap) => Object.entries(fieldMap)
  .filter(([bodyKey]) => body[bodyKey] !== undefined)
  .map(([bodyKey, column]) => [column, body[bodyKey]]);

export const buildUpdateSet = (updates) => ({
  setClause: updates.map(([column]) => `${column} = ?`).join(', '),
  values: updates.map(([, value]) => value)
});
