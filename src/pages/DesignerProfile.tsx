import { Navigate, useLocation, useParams } from "react-router-dom";

const DesignerProfile = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  if (!slug) {
    return <Navigate to="/designers" replace />;
  }

  return <Navigate to={`/designers/${slug}${location.search}${location.hash}`} replace />;
};

export default DesignerProfile;
