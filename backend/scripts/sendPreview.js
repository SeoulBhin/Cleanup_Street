const fetch = require('node-fetch');
const fs = require("fs");

async function main() {
  const image = fs.readFileSync("../test.jpg", { encoding: "base64" });
  const payload = {
    userId: 1,
    imageUrl: `data:image/jpeg;base64,${image}`,
  };

  const res = await fetch("http://localhost:9090/api/image-previews", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("응답:", data);
}

main().catch(console.error);
