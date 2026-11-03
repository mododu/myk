(function () {
  "use strict";

  var shell = document.querySelector(".app-shell");
  if (!shell) return;

  var treeHost = shell.querySelector("[data-file-tree]");
  var searchInput = shell.querySelector("[data-file-search]");
  var fileCount = shell.querySelector("[data-file-count]");
  var sidebarToggle = shell.querySelector("[data-sidebar-toggle]");
  var sidebarClose = shell.querySelector("[data-sidebar-close]");
  var sidebarBackdrop = shell.querySelector("[data-sidebar-backdrop]");
  var filePanelToggle = shell.querySelector("[data-file-panel-toggle]");
  var ribbonSearch = shell.querySelector("[data-ribbon-search]");
  var themeToggles = Array.prototype.slice.call(
    shell.querySelectorAll("[data-theme-toggle]")
  );
  var searchIndexUrl = shell.getAttribute("data-search-index-url");
  var currentUrl = shell.getAttribute("data-current-url") || "/";
  var totalPages = 0;
  var collapsedFolders = new Set();

  var icons = {
    chevron: '<svg class="tree-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m5 3 5 5-5 5"/></svg>',
    folder: '<svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3.5 6.5h6l2-2h3l2 2h4v12h-17z"/><path d="M3.5 9h17"/></svg>',
    file: '<svg class="tree-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4M9 12h6M9 15h5"/></svg>'
  };

  try {
    var savedFolders = JSON.parse(localStorage.getItem("obsidian-folder-state") || "[]");
    if (Array.isArray(savedFolders)) {
      collapsedFolders = new Set(savedFolders);
    }
  } catch (error) {
    collapsedFolders = new Set();
  }

  function normalizePath(value) {
    try {
      var parsed = new URL(value, window.location.href);
      return decodeURIComponent(parsed.pathname).replace(/\/+$/, "");
    } catch (error) {
      return String(value).replace(/\/+$/, "");
    }
  }

  function compareText(left, right) {
    return left.localeCompare(right, "zh-CN", {
      numeric: true,
      sensitivity: "base"
    });
  }

  function setSidebar(open) {
    document.body.classList.toggle("sidebar-open", open);
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-expanded", String(open));
    }
    if (filePanelToggle && window.matchMedia("(max-width: 900px)").matches) {
      filePanelToggle.setAttribute("aria-expanded", String(open));
    }
  }

  function setFilePanelCollapsed(collapsed) {
    document.body.classList.toggle("files-collapsed", collapsed);
    if (filePanelToggle) {
      filePanelToggle.classList.toggle("is-active", !collapsed);
      filePanelToggle.setAttribute("aria-expanded", String(!collapsed));
    }
    try {
      localStorage.setItem("obsidian-files-collapsed", collapsed ? "1" : "0");
    } catch (error) {}
  }

  function saveFolderState() {
    try {
      localStorage.setItem(
        "obsidian-folder-state",
        JSON.stringify(Array.from(collapsedFolders))
      );
    } catch (error) {
      // Local storage is optional; the tree still works without it.
    }
  }

  function renderTree(pages) {
    var root = {
      folders: new Map(),
      files: []
    };

    pages.forEach(function (page) {
      var path = String(page.path || page.title || "").split("/").filter(Boolean);
      var cursor = root;
      path.slice(0, -1).forEach(function (segment) {
        if (!cursor.folders.has(segment)) {
          cursor.folders.set(segment, {
            name: segment,
            path: (cursor.path ? cursor.path + "/" : "") + segment,
            folders: new Map(),
            files: []
          });
        }
        cursor = cursor.folders.get(segment);
      });
      cursor.files.push(page);
    });

    treeHost.innerHTML = "";
    var list = document.createElement("ul");
    list.className = "tree-root";
    appendChildren(list, root, "");
    treeHost.appendChild(list);

    var currentPath = normalizePath(currentUrl);
    Array.prototype.forEach.call(
      treeHost.querySelectorAll(".tree-file-link"),
      function (link) {
        if (normalizePath(link.getAttribute("href")) === currentPath) {
          link.classList.add("is-active");
          link.setAttribute("aria-current", "page");
          requestAnimationFrame(function () {
            link.scrollIntoView({ block: "nearest" });
          });
        }
      }
    );
  }

  function appendChildren(list, node, parentPath) {
    var folders = Array.from(node.folders.values()).sort(function (left, right) {
      return compareText(left.name, right.name);
    });
    var files = node.files.slice().sort(function (left, right) {
      return compareText(left.title || left.path, right.title || right.path);
    });

    folders.forEach(function (folder) {
      var folderPath = parentPath ? parentPath + "/" + folder.name : folder.name;
      var item = document.createElement("li");
      item.className = "tree-item tree-folder";
      item.dataset.folderPath = folderPath;

      var toggle = document.createElement("button");
      toggle.className = "tree-folder-toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = icons.chevron + icons.folder;

      var label = document.createElement("span");
      label.className = "tree-label";
      label.textContent = folder.name;
      toggle.appendChild(label);

      var count = document.createElement("span");
      count.className = "tree-count";
      count.textContent = String(countFiles(folder));
      toggle.appendChild(count);

      var children = document.createElement("ul");
      children.className = "tree-children";
      appendChildren(children, folder, folderPath);

      if (collapsedFolders.has(folderPath)) {
        item.classList.add("is-collapsed");
        toggle.setAttribute("aria-expanded", "false");
      }

      toggle.addEventListener("click", function () {
        var collapsed = item.classList.toggle("is-collapsed");
        toggle.setAttribute("aria-expanded", String(!collapsed));
        if (collapsed) {
          collapsedFolders.add(folderPath);
        } else {
          collapsedFolders.delete(folderPath);
        }
        saveFolderState();
      });

      item.appendChild(toggle);
      item.appendChild(children);
      list.appendChild(item);
    });

    files.forEach(function (page) {
      var item = document.createElement("li");
      item.className = "tree-item tree-file";
      item.dataset.searchText = String(
        (page.title || "") + " " + (page.path || "")
      ).toLocaleLowerCase("zh-CN");

      var link = document.createElement("a");
      link.className = "tree-file-link";
      link.href = page.url;
      link.innerHTML = icons.file;

      var label = document.createElement("span");
      label.className = "tree-label";
      label.textContent = page.title || page.path || "未命名笔记";
      link.appendChild(label);

      item.appendChild(link);
      list.appendChild(item);
    });
  }

  function countFiles(folder) {
    var count = folder.files.length;
    folder.folders.forEach(function (child) {
      count += countFiles(child);
    });
    return count;
  }

  function applyFilter(query) {
    var normalized = String(query || "").trim().toLocaleLowerCase("zh-CN");
    var fileItems = Array.prototype.slice.call(
      treeHost.querySelectorAll(".tree-file")
    );
    var folderItems = Array.prototype.slice.call(
      treeHost.querySelectorAll(".tree-folder")
    ).reverse();
    var visibleCount = 0;

    fileItems.forEach(function (item) {
      var matches = !normalized || item.dataset.searchText.indexOf(normalized) !== -1;
      item.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    folderItems.forEach(function (folder) {
      var hasVisibleFile = Array.prototype.some.call(
        folder.querySelectorAll(".tree-file"),
        function (file) { return !file.hidden; }
      );
      folder.hidden = !hasVisibleFile;
      if (normalized && hasVisibleFile) {
        folder.classList.remove("is-collapsed");
      } else if (!normalized) {
        var collapsed = collapsedFolders.has(folder.dataset.folderPath);
        folder.classList.toggle("is-collapsed", collapsed);
        var toggle = folder.querySelector(".tree-folder-toggle");
        if (toggle) toggle.setAttribute("aria-expanded", String(!collapsed));
      }
    });

    fileCount.textContent = normalized
      ? visibleCount + " / " + totalPages
      : totalPages + " 篇";
  }

  function loadPages() {
    if (!searchIndexUrl) {
      treeHost.innerHTML = '<div class="tree-error">未配置文件索引。</div>';
      fileCount.textContent = "不可用";
      return;
    }

    fetch(searchIndexUrl, { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then(function (pages) {
        if (!Array.isArray(pages) || pages.length === 0) {
          treeHost.innerHTML = '<div class="tree-empty">尚无已发布笔记。</div>';
          fileCount.textContent = "0 篇";
          return;
        }
        totalPages = pages.length;
        fileCount.textContent = totalPages + " 篇";
        renderTree(pages);
      })
      .catch(function () {
        treeHost.innerHTML = '<div class="tree-error">文件列表加载失败，请刷新页面重试。</div>';
        fileCount.textContent = "加载失败";
      });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      applyFilter(searchInput.value);
    });
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", function () {
      setSidebar(!document.body.classList.contains("sidebar-open"));
    });
  }
  if (sidebarClose) {
    sidebarClose.addEventListener("click", function () { setSidebar(false); });
  }
  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener("click", function () { setSidebar(false); });
  }
  if (filePanelToggle) {
    filePanelToggle.addEventListener("click", function () {
      if (window.matchMedia("(max-width: 900px)").matches) {
        setSidebar(!document.body.classList.contains("sidebar-open"));
      } else {
        setFilePanelCollapsed(!document.body.classList.contains("files-collapsed"));
      }
    });
  }
  if (ribbonSearch) {
    ribbonSearch.addEventListener("click", function () {
      setSidebar(true);
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    });
  }
  if (treeHost) {
    treeHost.addEventListener("click", function (event) {
      if (event.target.closest(".tree-file-link")) setSidebar(false);
    });
  }

  themeToggles.forEach(function (toggle) {
    toggle.addEventListener("click", function () {
      var current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      var next = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("obsidian-theme", next); } catch (error) {}
      updateThemeButtons();
    });
  });

  function updateThemeButtons() {
    var dark = document.documentElement.dataset.theme === "dark";
    themeToggles.forEach(function (toggle) {
      toggle.setAttribute("aria-label", dark ? "切换浅色模式" : "切换深色模式");
      toggle.setAttribute("title", dark ? "切换浅色模式" : "切换深色模式");
    });
  }

  document.addEventListener("keydown", function (event) {
    var key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === "k") {
      event.preventDefault();
      setSidebar(true);
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    } else if ((event.ctrlKey || event.metaKey) && key === "b") {
      event.preventDefault();
      setSidebar(!document.body.classList.contains("sidebar-open"));
    } else if (event.key === "Escape") {
      if (document.body.classList.contains("sidebar-open")) {
        setSidebar(false);
      } else if (searchInput && document.activeElement === searchInput) {
        searchInput.value = "";
        applyFilter("");
        searchInput.blur();
      }
    }
  });

  try {
    if (localStorage.getItem("obsidian-files-collapsed") === "1") {
      setFilePanelCollapsed(true);
    }
  } catch (error) {}

  updateThemeButtons();
  loadPages();
})();
