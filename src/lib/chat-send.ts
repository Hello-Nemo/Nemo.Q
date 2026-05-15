export async function sendChatMessage(
  sendMessage: (message: { text: string }, options?: { body?: { model: string } }) => void | Promise<void>,
  model: string,
  message: { text: string },
) {
  await sendMessage(message, {
    body: {
      model,
    },
  });
}
