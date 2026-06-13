import { Component } from '@angular/core';
import { Chat as ChatComponent } from '../../../shared/components/chat/chat';

@Component({
  selector: 'app-ws-chat',
  standalone: true,
  imports: [ChatComponent],
  template: `<app-chat />`,
  styles: [`:host { display: block; height: 100vh; }`],
})
export class WsChat {}