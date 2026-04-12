// jsPDF CDN loader for Cover Letter Generator
(function() {
  if (window.jspdf || window.jsPDF) return;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
  script.onload = function() {
    window.jspdf = window.jspdf || window.jsPDF ? { jsPDF: window.jsPDF } : window.jspdf;
  };
  document.head.appendChild(script);
})();
