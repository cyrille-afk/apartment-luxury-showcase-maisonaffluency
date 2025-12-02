const Footer = () => {
  return <footer className="border-t border-border bg-background px-6 py-12 md:px-12 lg:px-20">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="text-center md:text-left">
            <div className="mb-2 font-display text-2xl text-foreground">Maison Affluency Showcase</div>
            <p className="font-body text-sm text-muted-foreground">
              Professional Design Portfolio
            </p>
          </div>
          
          <div className="flex gap-8">
            <a href="#" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Specifications
            </a>
            <a className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground" href="https://thierry-lemaire.fr/en/">
              Designers
            </a>
            <a href="#" className="font-body text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </a>
          </div>
        </div>
        
        <div className="mt-8 border-t border-border pt-8 text-center">
          <p className="font-body text-xs text-muted-foreground">© 2026 Affluency ETC Pte Ltd. All rights reserved. For professional use only.</p>
        </div>
      </div>
    </footer>;
};
export default Footer;