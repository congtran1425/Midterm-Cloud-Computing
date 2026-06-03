import { query } from "./Backend/src/config/db.js";
query("SELECT * FROM receipts ORDER BY receipt_id DESC LIMIT 5;").then(res => {
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
