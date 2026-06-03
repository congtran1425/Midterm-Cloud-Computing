import { query } from "./Backend/src/config/db.js";
query("SELECT transaction_id, customer_name, total_amount, order_status FROM sales_transactions ORDER BY transaction_id DESC LIMIT 5;").then(res => {
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
