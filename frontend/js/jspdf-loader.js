// jsPDF CDN loader for Cover Letter Generator
(function() {
  if (window.jspdf && window.jspdf.jsPDF) return;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  script.onload = function() {
    if (window.jspdf && window.jspdf.jsPDF) return;
    if (window.jspdf) return;
    if (window.jsPDF) {
      window.jspdf = { jsPDF: window.jsPDF };
    } else if (window.jspdf) {
      // already loaded
    } else if (window.jspdf && window.jspdf.jsPDF) {
      // already loaded
    }
  };
  document.head.appendChild(script);
})();
