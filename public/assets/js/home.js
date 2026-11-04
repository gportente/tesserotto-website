// Registrazioni dell'app: partono quando sono a schermo e si fermano quando escono.
// Con "riduci movimento" restano ferme sul poster, con i controlli visibili.
// Senza JavaScript i video hanno i controlli nativi e partono solo a richiesta.

const videos = document.querySelectorAll("video[data-autoplay]");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function takeOver(video) {
  video.controls = false;
  video.preload = "metadata";
}

function giveBack(video) {
  video.pause();
  video.controls = true;
}

if (videos.length && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const video = entry.target;
        if (reduceMotion.matches) continue;
        if (entry.isIntersecting) {
          video.play().catch(() => giveBack(video));
        } else {
          video.pause();
        }
      }
    },
    { threshold: 0.5 },
  );

  const apply = () => {
    for (const video of videos) {
      if (reduceMotion.matches) giveBack(video);
      else takeOver(video);
    }
  };

  apply();
  reduceMotion.addEventListener("change", apply);
  videos.forEach((video) => observer.observe(video));
}
