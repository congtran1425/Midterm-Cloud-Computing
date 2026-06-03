import { query } from "./Backend/src/config/db.js";
query("SHOW COLUMNS FROM sales_transactions;").then(res => {
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
