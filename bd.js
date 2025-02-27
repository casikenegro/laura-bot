const fetchDataFromAppsScript = async () => {
  try {
    const response = await axios.get(
      "https://script.google.com/macros/s/AKfycbyD9u_jcX2z_hK_ZDf5SLqdzIiF0ygyKkFIAE4LUevR4q48aLLgTkQdX8_LBqUSR4H_/exec"
    );
    return response.data; // Assuming the endpoint returns JSON
  } catch (error) {
    console.error("Error fetching data from Apps Script:", error);
    return null;
  }
};

