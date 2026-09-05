"use client";

import { useEffect, useRef } from "react";
import { SgdsLink, SgdsModal } from "@govtechsg/sgds-web-component/react";

type ModalElement = HTMLElement & {
  show: () => Promise<void> | undefined;
  hide: () => Promise<void> | undefined;
};

export default function AboutMapModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const modalRef = useRef<ModalElement>(null);

  useEffect(() => {
    if (isOpen) modalRef.current?.show();
    else modalRef.current?.hide();
  }, [isOpen]);

  return (
    <SgdsModal ref={modalRef} size="md" onSgdsClose={onClose}>
      <h2 slot="title" className="sgds:text-heading-md sgds:font-semibold sgds:leading-md sgds:tracking-tight sgds:text-heading-default">About HDB Pricing</h2>

      <div className="sgds:flex sgds:flex-col sgds:gap-component-md">
        <section aria-labelledby="why-this-map">
          <h3 id="why-this-map" className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">Why I made this</h3>
          <div className="sgds:mt-text-xs sgds:flex sgds:flex-col sgds:gap-text-xs">
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">We all have a rough sense of which neighbourhoods are more expensive and which are more affordable. But it always bugged me that we rarely get to properly quantify those impressions.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">I created HDB Pricing to make that information easier to explore. Using resale transaction data released by HDB on data.gov.sg, the map shows flats sold over the past year, so you can get a more grounded sense of prices in the areas you care about.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">Whether you are casually curious about your neighbourhood, helping your parents compare prices, or beginning your own home-buying journey, I hope this makes the process a little more transparent—and a little less overwhelming.</p>
          </div>
        </section>

        <section aria-labelledby="how-it-works">
          <h3 id="how-it-works" className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">How it works</h3>
          <div className="sgds:mt-text-xs sgds:flex sgds:flex-col sgds:gap-text-xs">
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">HDB Pricing brings together publicly available HDB resale transaction data and mapping tools to make recent prices easier to explore visually.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">The site is built with Next.js, React and TypeScript, which power the responsive, interactive experience, from filtering transactions to selecting blocks on the map. The interface uses components from the Singapore Design System, while Leaflet provides the map interactions such as browsing, zooming and viewing nearby transactions.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">Behind the scenes, the resale data and block-level summaries are organised in a database. OneMap helps place HDB blocks accurately on the map, turning addresses into locations you can explore. The site may also use privacy-conscious analytics to understand, at a high level, how people use it and where it can be improved.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">The goal is simple: take a large public dataset and turn it into something more intuitive, useful and enjoyable to browse.</p>
          </div>
        </section>

        <section aria-labelledby="about-me">
          <h3 id="about-me" className="sgds:text-heading-sm sgds:font-semibold sgds:leading-sm sgds:tracking-tight sgds:text-heading-default">About me</h3>
          <div className="sgds:mt-text-xs sgds:flex sgds:flex-col sgds:gap-text-xs">
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">Hey! I’m Ernest, an Average Joe who enjoys building small things that make everyday information a little easier to understand. Outside of my computer, you can probably find me out for a run, volunteering, or chatting with people and hearing their stories.</p>
            <p className="sgds:text-body-md sgds:font-regular sgds:leading-xs sgds:tracking-normal sgds:text-body-default">I made HDB Pricing as a personal project because housing shapes so much of life in Singapore, and I wanted to make public data feel more approachable. If this site has been useful to you and you’d like to support its upkeep, or simply fuel the next feature, <SgdsLink size="md" tone="neutral"><a href="https://buymeacoffee.com/ernesttanhl" target="_blank" rel="noreferrer">buy me a coffee</a></SgdsLink>. I’d really appreciate it ☕</p>
          </div>
        </section>
      </div>
    </SgdsModal>
  );
}
