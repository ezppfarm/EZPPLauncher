declare global {
  const umami: Umami;
}

/**
 * @see {@link https://umami.is/docs/tracker-functions|Umami Docs}
 */
interface Umami {
  track(): Promise<string> | undefined;
  track(event_name: string, event_data?: Record<string, unknown>): Promise<string> | undefined;
  track(custom_payload: { website: string; [key: string]: unknown }): Promise<string> | undefined;
  track(
    callback: (props: {
      hostname: string;
      language: string;
      referrer: string;
      screen: string;
      title: string;
      url: string;
      website: string;
    }) => { website: string; [key: string]: unknown }
  ): Promise<string> | undefined;

  /** Pass in your own ID to identify a user. */
  identify(identity_id: string): Promise<void>;

  /** Save data about the current session. */
  identify(identity_id: string, data: Record<string, unknown>): Promise<void>;

  /** To save data without a unique ID, pass in only a JSON object. */
  identify(data: Record<string, unknown>): Promise<void>;
}

export {};
