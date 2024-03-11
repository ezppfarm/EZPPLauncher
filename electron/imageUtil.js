async function checkImageExists(url) {
  try {
    const response = await fetch(url, { method: "HEAD" });
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
