// Component and journey pages: every box or stop of the diagram that carries data-ref opens its
// page when clicked, or focused and Enter is pressed (catalogue-site, Neighbourhood diagram).
import { makeLink, pageOf } from './links.ts';

for (const element of document.querySelectorAll<SVGElement>('[data-diagram] svg [data-ref]')) {
  const url = pageOf(element.getAttribute('data-ref') ?? '');
  if (url) makeLink(element, url);
}
