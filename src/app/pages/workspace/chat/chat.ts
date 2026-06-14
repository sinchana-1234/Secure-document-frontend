import { Component } from '@angular/core';
import { Chat as ChatComponent } from '../../../shared/components/chat/chat';

@Component({
  selector: 'app-ws-chat',
  standalone: true,
  imports: [ChatComponent],
  template: `<app-chat />`,
  styles: [`:host { display: flex; flex-direction: column; flex: 1; min-height: 0; }`],
})
export class WsChat {}