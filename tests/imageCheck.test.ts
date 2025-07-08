import { expect, test } from 'bun:test';

const urlIsValidImage = async (url: string) => {
  try {
    const request = await fetch(url);
    if (!request.ok) return false;
    const contentType = request.headers.get('content-type');
    return contentType?.startsWith('image/');
  } catch {
    return false;
  }
};

test('image check', async () => {
  const imageUrl = 'https://assets.ppy.sh/beatmaps/1/covers/list@2x.jpg';
  const imageCheckResult = await urlIsValidImage(imageUrl);
  expect(imageCheckResult).toBe(true);
});

test('image check fail', async () => {
  const imageUrl = 'https://assets.ppy.sh/beatmaps/0/covers/list@2x.jpg';
  const imageCheckResult = await urlIsValidImage(imageUrl);
  expect(imageCheckResult).toBe(false);
});
