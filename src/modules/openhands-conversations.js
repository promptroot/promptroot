const apiKey = "sk-oh-9E5VVZzlqlJ4IY3HYlWE1ukgtOQlbB2c";
const url = "https://app.all-hands.dev/api/v1/app-conversations";

const headers = {
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
};


async function retrieveConversations() {
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: headers
        });

        const result = await response.json();
        console.log(`Retrieved Conversations:`, result);

        return result;
    } catch (error) {
        console.error("Error retrieving conversations:", error);
    }
}

retrieveConversations();