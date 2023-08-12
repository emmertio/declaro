import type { IStore } from "@declaro/core";

export type RequestError = { requestId: string, message: string }

export class RequestErrorStore implements IStore {
  private value: { [key: string]: RequestError } = {};
  private subscribers: Array<(value: { [key: string]: RequestError }) => void> = [];

  subscribe(subscription: (value: { [key: string]: RequestError }) => void): (() => void) {
    // Add the new subscriber to the subscribers array
    this.subscribers.push(subscription);

    // Immediately call the subscription with the current value
    subscription(this.value);

    // Return an unsubscribe function
    return () => {
      // Remove the subscriber from the subscribers array
      this.subscribers = this.subscribers.filter(sub => sub !== subscription);
    };
  }

  public push(error: RequestError) {
    this.value = { ...this.value, [error.requestId]: error };

    this.subscribers.forEach(sub => sub(this.value));
  }

  public remove(requestId: string) {
    const { [requestId]: removedError, ...rest } = this.value;
    this.value = rest;

    this.subscribers.forEach(sub => sub(this.value));
  }
}
