import { TestBed } from '@angular/core/testing';
import { App } from './app';
import {
  DCC_TRANSPORT,
  DccSessionService,
  UnavailableDccTransport,
} from 'common';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        DccSessionService,
        {
          provide: DCC_TRANSPORT,
          useClass: UnavailableDccTransport,
        },
      ],
    }).compileComponents();
  });

  it('explains that serial communication is not configured', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Read or write a CV');
    expect(compiled.textContent).toContain(
      'Serial communication is not configured in this build.'
    );
    expect(
      compiled.querySelector<HTMLButtonElement>('.operation-button')?.disabled
    ).toBe(true);
  });
});
