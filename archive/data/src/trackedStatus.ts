import type { IStore } from "@declaro/core";

export type RequestStatus = { requestId: string, error: boolean, message: string }

export class TrackedStatusStore implements IStore {
  private value: { [key: string]: RequestStatus } = {};
  private subscribers: Array<(value: { [key: string]: RequestStatus }) => void> = [];

  subscribe(subscription: (value: { [key: string]: RequestStatus }) => void): (() => void) {
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

  public push(status: RequestStatus) {
    this.value = { ...this.value, [status.requestId]: status };

    this.subscribers.forEach(sub => sub(this.value));
  }

  public remove(requestId: string) {
    const { [requestId]: removedError, ...rest } = this.value;
    this.value = rest;

    this.subscribers.forEach(sub => sub(this.value));
  }
}
