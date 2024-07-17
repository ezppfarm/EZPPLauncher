async function checkImageExists(url) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
      },
    });
    if (!response.ok) {
      return false;
    }
    const contentType = response.headers.get("content-type");
    if (!contentType) return false;
    return contentType.startsWith("image/");
  } catch (error) {
    return false;
  }
}

module.exports = { checkImageExists };
