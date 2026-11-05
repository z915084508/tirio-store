// Enhancement only: without JavaScript all original product images remain visible.
if (!customElements.get('tirio-product-gallery')) {
  customElements.define('tirio-product-gallery', class extends HTMLElement {
    connectedCallback() {
      this.images = [...this.querySelectorAll('[data-product-image]')];
      this.buttons = [...this.querySelectorAll('[data-gallery-index]')];
      const controls = this.querySelector('[data-gallery-controls]');
      if (!controls || this.images.length < 2 || this.buttons.length !== this.images.length) return;
      this.onGalleryClick = event => {
        const button = event.target.closest('[data-gallery-index]');
        if (!button || !this.contains(button)) return;
        const index = Number(button.dataset.galleryIndex);
        if (!Number.isInteger(index) || index < 0 || index >= this.images.length) return;
        this.selectImage(index);
      };
      this.addEventListener('click', this.onGalleryClick);
      this.selectImage(0);
      controls.hidden = false;
    }
    disconnectedCallback() {
      if (this.onGalleryClick) this.removeEventListener('click', this.onGalleryClick);
    }
    selectImage(index) {
      this.images.forEach((image, i) => { image.hidden = i !== index; });
      this.buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
  });
}
