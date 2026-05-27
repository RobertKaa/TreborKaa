import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../services/i18n.service';

type PrivacySection = {
  titleKey: string;
  textKey: string;
};

@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.scss',
})
export class PrivacyPageComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly sections: PrivacySection[] = [
    {
      titleKey: 'privacy.dataTitle',
      textKey: 'privacy.dataText',
    },
    {
      titleKey: 'privacy.publicTitle',
      textKey: 'privacy.publicText',
    },
    {
      titleKey: 'privacy.storageTitle',
      textKey: 'privacy.storageText',
    },
    {
      titleKey: 'privacy.rightsTitle',
      textKey: 'privacy.rightsText',
    },
  ];
}
